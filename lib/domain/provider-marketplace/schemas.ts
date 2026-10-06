import { z } from "zod";
import { pricingModels } from "./types";

const money = z.string().trim().regex(/^\d{1,12}(?:\.\d{1,2})?$/).refine(value=>Number(value)>0);
const optionalMoney = z.union([money,z.literal("")]).optional().transform(value=>value || undefined);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value=>value || undefined);

const serviceAreaSchema = z.object({
  remoteService: z.boolean(),
  stateCode: optionalText(8),
  lgaCode: optionalText(12),
  approximateOrigin: optionalText(160),
  radiusKm: z.union([z.number(),z.string().trim()]).optional().transform(value=>value === undefined || value === "" ? undefined : Number(value)),
});

export const providerServiceSchema = z.object({
  categoryId: z.uuid(),
  serviceDefinitionId: z.uuid(),
  publicTitle: z.string().trim().min(2).max(120),
  description: z.string().trim().min(20).max(2000),
  pricingModel: z.enum(pricingModels),
  priceMin: optionalMoney,
  priceMax: optionalMoney,
  supportsRemote: z.boolean(),
  supportsOnsite: z.boolean(),
  status: z.enum(["DRAFT","PUBLISHED"]),
  durationMinutes: z.array(z.coerce.number().int().min(15).max(10080)).min(1).max(20),
  areas: z.array(serviceAreaSchema).min(1).max(20),
}).superRefine((value,context)=>{
  const issue=(path:(string|number)[],message:string)=>context.addIssue({code:"custom",path,message});
  const minimum=value.priceMin ? Number(value.priceMin) : undefined;
  const maximum=value.priceMax ? Number(value.priceMax) : undefined;
  if (value.pricingModel==="QUOTE_REQUIRED" && (minimum!==undefined || maximum!==undefined)) issue(["priceMin"],"Quote-required services cannot include a price.");
  if (value.pricingModel==="FIXED" && minimum===undefined) issue(["priceMin"],"Enter the fixed price.");
  if (value.pricingModel==="FIXED" && maximum!==undefined && maximum!==minimum) issue(["priceMax"],"A fixed maximum must equal the fixed price.");
  if (["STARTING_AT","HOURLY","DAILY"].includes(value.pricingModel) && minimum===undefined) issue(["priceMin"],"Enter the minimum price.");
  if (minimum!==undefined && maximum!==undefined && maximum<minimum) issue(["priceMax"],"Maximum price cannot be below minimum price.");
  if (!value.supportsRemote && !value.supportsOnsite) issue(["supportsOnsite"],"Choose at least one delivery mode.");
  const remoteAreas=value.areas.filter(area=>area.remoteService);
  const onsiteAreas=value.areas.filter(area=>!area.remoteService);
  if (value.supportsRemote && remoteAreas.length!==1) issue(["supportsRemote"],"Remote delivery requires one remote service area.");
  if (!value.supportsRemote && remoteAreas.length) issue(["supportsRemote"],"Remove the remote area or enable remote delivery.");
  if (value.supportsOnsite && !onsiteAreas.length) issue(["stateCode"],"On-site delivery requires a state.");
  if (!value.supportsOnsite && onsiteAreas.length) issue(["supportsOnsite"],"Remove physical areas or enable on-site delivery.");
  onsiteAreas.forEach((area,index)=>{
    const path=value.areas.indexOf(area);
    if (!area.stateCode || !/^NG\d{3}$/.test(area.stateCode)) issue(["areas",path,"stateCode"],"Choose a valid state.");
    if (area.lgaCode && !/^NG\d{6}$/.test(area.lgaCode)) issue(["areas",path,"lgaCode"],"Choose a valid LGA.");
    if (area.radiusKm!==undefined && (!area.approximateOrigin || !Number.isFinite(area.radiusKm) || area.radiusKm<=0 || area.radiusKm>1000)) issue(["areas",path,"radiusKm"],"A radius from 1 to 1000 km requires a broad approximate origin.");
    if (index>19) issue(["areas"],"Too many service areas.");
  });
  if (new Set(value.durationMinutes).size!==value.durationMinutes.length) issue(["durationMinutes"],"Service durations must be unique.");
  const areaKeys=value.areas.map(area=>area.remoteService?"remote":`${area.stateCode}:${area.lgaCode||""}`);
  if (new Set(areaKeys).size!==areaKeys.length) issue(["areas"],"Service areas must be unique.");
});

const availabilityRuleSchema = z.object({
  providerServiceId: z.uuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  localStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  localEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.literal("Africa/Lagos"),
  effectiveFrom: z.iso.date().optional(),
  effectiveTo: z.iso.date().optional(),
});

export const availabilityRulesSchema = z.array(availabilityRuleSchema).max(50).superRefine((rules,context)=>{
  rules.forEach((rule,index)=>{
    if (rule.localEnd<=rule.localStart) context.addIssue({code:"custom",path:[index,"localEnd"],message:"End time must be after start time."});
    if (rule.effectiveFrom && rule.effectiveTo && rule.effectiveTo<rule.effectiveFrom) context.addIssue({code:"custom",path:[index,"effectiveTo"],message:"Effective end date must not precede its start date."});
  });
  for (let left=0;left<rules.length;left++) for (let right=left+1;right<rules.length;right++) {
    const a=rules[left],b=rules[right];
    const datesOverlap=(!a.effectiveFrom || !b.effectiveTo || a.effectiveFrom<=b.effectiveTo) && (!b.effectiveFrom || !a.effectiveTo || b.effectiveFrom<=a.effectiveTo);
    if (a.dayOfWeek===b.dayOfWeek && a.providerServiceId===b.providerServiceId && datesOverlap && a.localStart<b.localEnd && b.localStart<a.localEnd) {
      context.addIssue({code:"custom",path:[right,"localStart"],message:"Availability periods cannot overlap."});
    }
  }
});

export const blackoutSchema = z.object({
  startsAt: z.iso.datetime({offset:true}),
  endsAt: z.iso.datetime({offset:true}),
  reason: optionalText(500),
}).refine(value=>Date.parse(value.endsAt)>Date.parse(value.startsAt),{path:["endsAt"],message:"End time must be after start time."});
