import { z } from "zod";
import { nearbyRadii, providerSearchSorts } from "./types";

const firstString = z.preprocess(value => Array.isArray(value) ? value[0] : value, z.string().optional());
const optionalBounded = (max:number) => firstString.transform(value => value?.trim() || undefined).pipe(z.string().max(max).optional());
const optionalCode = (pattern:RegExp) => optionalBounded(12).refine(value => value === undefined || pattern.test(value),"Invalid location code.");
function isCalendarDate(value:string|undefined) {
  if (value === undefined) return true;
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}

export const providerSearchParamsSchema = z.object({
  q: optionalBounded(100),
  category: optionalBounded(80).refine(value => value === undefined || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),"Invalid category."),
  state: optionalCode(/^NG\d{3}$/),
  lga: optionalCode(/^NG\d{6}$/),
  remote: firstString.transform(value => value === "1" || value === "true"),
  date: optionalBounded(10).refine(isCalendarDate,"Invalid date."),
  nearby: firstString.transform(value => value === "1" || value === "true"),
  radius: firstString.transform(value => value ? Number(value) : 25).pipe(z.union(nearbyRadii.map(value => z.literal(value)) as [z.ZodLiteral<5>,z.ZodLiteral<10>,z.ZodLiteral<25>,z.ZodLiteral<50>])),
  sort: firstString.transform(value => value || "best").pipe(z.enum(providerSearchSorts)),
  page: firstString.transform(value => value ? Number(value) : 1).pipe(z.number().int().min(1).max(10000)),
}).strict();

export const privateNearbySchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  radiusKm: z.union(nearbyRadii.map(value => z.literal(value)) as [z.ZodLiteral<5>,z.ZodLiteral<10>,z.ZodLiteral<25>,z.ZodLiteral<50>]),
});

export const providerOriginSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
