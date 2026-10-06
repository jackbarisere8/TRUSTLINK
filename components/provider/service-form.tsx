"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProviderServiceAction } from "@/app/actions/provider-marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PricingModel, ProviderMarketplaceCatalog, ProviderService } from "@/lib/domain/provider-marketplace";

type AreaDraft = { key: string; stateCode: string; lgaCode: string; approximateOrigin: string; radiusKm: string };

const pricingOptions: Array<{ value: PricingModel; label: string }> = [
  { value: "FIXED", label: "Fixed price" },
  { value: "STARTING_AT", label: "Starting at" },
  { value: "HOURLY", label: "Per hour" },
  { value: "DAILY", label: "Per day" },
  { value: "QUOTE_REQUIRED", label: "Quote required" },
];

function newArea(): AreaDraft {
  return { key: crypto.randomUUID(), stateCode: "", lgaCode: "", approximateOrigin: "", radiusKm: "" };
}

function first(errors: Record<string, string[]> | undefined, ...keys: string[]) {
  for (const key of keys) if (errors?.[key]?.[0]) return errors[key][0];
}

export function ServiceForm({ catalog, initial }: { catalog: ProviderMarketplaceCatalog; initial?: ProviderService }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(initial?.categoryId || catalog.categories[0]?.id || "");
  const definitions = useMemo(() => catalog.categories.find(category => category.id === categoryId)?.definitions || [], [catalog.categories, categoryId]);
  const [definitionId, setDefinitionId] = useState(initial?.serviceDefinitionId || catalog.categories.find(category => category.id === categoryId)?.definitions[0]?.id || "");
  const [pricingModel, setPricingModel] = useState<PricingModel>(initial?.pricingModel || "STARTING_AT");
  const [supportsRemote, setSupportsRemote] = useState(initial?.supportsRemote ?? true);
  const [supportsOnsite, setSupportsOnsite] = useState(initial?.supportsOnsite ?? false);
  const [areas, setAreas] = useState<AreaDraft[]>(() => {
    const physical = initial?.areas.filter(area => !area.remoteService).map(area => ({
      key: area.id || crypto.randomUUID(),
      stateCode: area.stateCode || "",
      lgaCode: area.lgaCode || "",
      approximateOrigin: area.approximateOrigin || "",
      radiusKm: area.radiusKm === undefined ? "" : String(area.radiusKm),
    }));
    return physical?.length ? physical : [newArea()];
  });
  const [errors, setErrors] = useState<Record<string, string[]>>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const updateArea = (key: string, patch: Partial<AreaDraft>) => setAreas(current => current.map(area => area.key === key ? { ...area, ...patch } : area));

  return <form className="space-y-8" onSubmit={event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const input = {
      categoryId,
      serviceDefinitionId: definitionId,
      publicTitle: values.get("publicTitle"),
      description: values.get("description"),
      pricingModel,
      priceMin: pricingModel === "QUOTE_REQUIRED" ? undefined : values.get("priceMin"),
      priceMax: pricingModel === "QUOTE_REQUIRED" ? undefined : values.get("priceMax"),
      supportsRemote,
      supportsOnsite,
      status: values.get("published") ? "PUBLISHED" : "DRAFT",
      durationMinutes: String(values.get("durationMinutes") || "").split(/[\s,]+/).filter(Boolean),
      areas: [
        ...(supportsRemote ? [{ remoteService: true }] : []),
        ...(supportsOnsite ? areas.map(area => ({
          remoteService: false,
          stateCode: area.stateCode,
          lgaCode: area.lgaCode || undefined,
          approximateOrigin: area.approximateOrigin || undefined,
          radiusKm: area.radiusKm || undefined,
        })) : []),
      ],
    };
    setError(""); setMessage(""); setErrors(undefined);
    startTransition(async () => {
      try {
        const result = await saveProviderServiceAction(initial?.id, input);
        if (result.error) { setError(result.error); setErrors(result.fieldErrors); return; }
        setMessage("Service saved.");
        router.push("/dashboard/services");
        router.refresh();
      } catch {
        setError("Connection interrupted. Please try again.");
      }
    });
  }}>
    <section className="space-y-5" aria-labelledby="service-basics-heading">
      <div><h2 id="service-basics-heading" className="text-lg font-semibold text-navy-900">Service details</h2><p className="mt-1 text-sm leading-6 text-surface-600">Choose an approved category and describe exactly what a customer can request.</p></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-navy-900">Category
          <select className="h-11 rounded border border-surface-200 bg-white px-3 text-sm" value={categoryId} onChange={event => {
            const next = event.target.value;
            setCategoryId(next);
            setDefinitionId(catalog.categories.find(category => category.id === next)?.definitions[0]?.id || "");
          }} aria-invalid={Boolean(first(errors,"categoryId"))}>
            {catalog.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          {first(errors,"categoryId") && <span className="text-xs font-medium text-danger" role="alert">{first(errors,"categoryId")}</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-navy-900">Service
          <select className="h-11 rounded border border-surface-200 bg-white px-3 text-sm" value={definitionId} onChange={event => setDefinitionId(event.target.value)} aria-invalid={Boolean(first(errors,"serviceDefinitionId"))}>
            {definitions.map(definition => <option key={definition.id} value={definition.id}>{definition.name}</option>)}
          </select>
          {first(errors,"serviceDefinitionId") && <span className="text-xs font-medium text-danger" role="alert">{first(errors,"serviceDefinitionId")}</span>}
        </label>
      </div>
      <Input name="publicTitle" label="Public service title" defaultValue={initial?.publicTitle} maxLength={120} placeholder="Professional business website development" error={first(errors,"publicTitle")} required />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-navy-900">Description
        <textarea name="description" defaultValue={initial?.description} className="min-h-36 rounded border border-surface-200 bg-white p-3 text-sm leading-6" minLength={20} maxLength={2000} aria-invalid={Boolean(first(errors,"description"))} required />
        {first(errors,"description") ? <span className="text-xs font-medium text-danger" role="alert">{first(errors,"description")}</span> : <span className="text-xs font-normal text-surface-500">Include scope, exclusions, and what the customer should prepare.</span>}
      </label>
    </section>

    <section className="space-y-5 border-t border-surface-200 pt-8" aria-labelledby="service-pricing-heading">
      <div><h2 id="service-pricing-heading" className="text-lg font-semibold text-navy-900">Pricing and duration</h2><p className="mt-1 text-sm leading-6 text-surface-600">Prices are recorded in Nigerian naira. You can require a quote without showing a price.</p></div>
      <label className="flex max-w-sm flex-col gap-1.5 text-sm font-medium text-navy-900">Pricing model
        <select className="h-11 rounded border border-surface-200 bg-white px-3 text-sm" value={pricingModel} onChange={event => setPricingModel(event.target.value as PricingModel)}>
          {pricingOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {pricingModel !== "QUOTE_REQUIRED" && <div className="grid gap-5 sm:grid-cols-2">
        <Input name="priceMin" label={pricingModel === "FIXED" ? "Price (NGN)" : "Minimum price (NGN)"} inputMode="decimal" defaultValue={initial?.priceMin} placeholder="50000" error={first(errors,"priceMin")} required />
        {pricingModel !== "FIXED" && <Input name="priceMax" label="Maximum price (optional)" inputMode="decimal" defaultValue={initial?.priceMax} placeholder="150000" error={first(errors,"priceMax")} />}
      </div>}
      <Input name="durationMinutes" label="Available durations in minutes" defaultValue={initial?.durationMinutes.join(", ") || "60"} placeholder="60, 120, 240" hint="Separate each duration with a comma. Use 1440 for one day." error={first(errors,"durationMinutes")} required />
    </section>

    <section className="space-y-5 border-t border-surface-200 pt-8" aria-labelledby="service-area-heading">
      <div><h2 id="service-area-heading" className="text-lg font-semibold text-navy-900">Delivery and service areas</h2><p className="mt-1 text-sm leading-6 text-surface-600">Use only broad areas. Never enter a home address or precise coordinates.</p></div>
      <div className="flex flex-wrap gap-6">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={supportsRemote} onChange={event => setSupportsRemote(event.target.checked)} /> Remote service</label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={supportsOnsite} onChange={event => setSupportsOnsite(event.target.checked)} /> On-site service</label>
      </div>
      {first(errors,"supportsRemote","supportsOnsite") && <p className="text-xs font-medium text-danger" role="alert">{first(errors,"supportsRemote","supportsOnsite")}</p>}
      {supportsOnsite && <div className="space-y-5">
        {areas.map((area, index) => {
          const state = catalog.states.find(candidate => candidate.code === area.stateCode);
          return <fieldset key={area.key} className="rounded border border-surface-200 bg-surface-50 p-4 sm:p-5">
            <legend className="px-2 text-sm font-semibold text-navy-900">Area {index + 1}</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-navy-900">State or FCT
                <select className="h-11 rounded border border-surface-200 bg-white px-3 text-sm" value={area.stateCode} onChange={event => updateArea(area.key,{ stateCode:event.target.value, lgaCode:"" })} required>
                  <option value="">Choose state</option>
                  {catalog.states.map(candidate => <option key={candidate.code} value={candidate.code}>{candidate.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-navy-900">LGA or area council (optional)
                <select className="h-11 rounded border border-surface-200 bg-white px-3 text-sm" value={area.lgaCode} onChange={event => updateArea(area.key,{ lgaCode:event.target.value })} disabled={!state}>
                  <option value="">All areas in state</option>
                  {state?.lgas.map(lga => <option key={lga.code} value={lga.code}>{lga.name}</option>)}
                </select>
              </label>
              <Input label="Approximate origin (optional)" value={area.approximateOrigin} onChange={event => updateArea(area.key,{approximateOrigin:event.target.value})} placeholder="Ikeja area" maxLength={160} />
              <Input label="Travel radius in km (optional)" value={area.radiusKm} onChange={event => updateArea(area.key,{radiusKm:event.target.value})} inputMode="decimal" placeholder="25" />
            </div>
            {areas.length > 1 && <Button className="mt-4" type="button" variant="ghost" size="sm" onClick={() => setAreas(current => current.filter(candidate => candidate.key !== area.key))}>Remove area</Button>}
          </fieldset>;
        })}
        <Button type="button" variant="outline" onClick={() => setAreas(current => [...current,newArea()])}>Add another area</Button>
      </div>}
      {first(errors,"areas","stateCode","lgaCode","radiusKm") && <p className="text-xs font-medium text-danger" role="alert">{first(errors,"areas","stateCode","lgaCode","radiusKm")}</p>}
    </section>

    <section className="space-y-4 border-t border-surface-200 pt-8">
      <label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1.5" name="published" type="checkbox" defaultChecked={initial?.status === "PUBLISHED"} /><span><strong className="block text-navy-900">Make this service active</strong>Active services may appear only after the provider profile is also published.</span></label>
      {error && <p className="border border-red-200 bg-danger-light p-3 text-sm font-medium text-danger-text" role="alert">{error}</p>}
      {message && <p className="border border-teal-200 bg-teal-50 p-3 text-sm font-medium text-teal-900" role="status">{message}</p>}
      <div className="flex flex-wrap gap-3"><Button type="submit" loading={pending}>{initial ? "Save service" : "Create service"}</Button><Button type="button" variant="outline" onClick={() => router.push("/dashboard/services")}>Cancel</Button></div>
    </section>
  </form>;
}
