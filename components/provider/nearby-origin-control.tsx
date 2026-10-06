"use client";

import { useState, useTransition } from "react";
import { MapPin, ShieldCheck } from "lucide-react";
import { setProviderNearbyOriginAction } from "@/app/actions/provider-marketplace";
import { Button } from "@/components/ui/button";

export function NearbyOriginControl({ serviceId, enabled, eligible }: { serviceId: string; enabled: boolean; eligible: boolean }) {
  const [active, setActive] = useState(enabled);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const enable = () => {
    setError(""); setMessage("");
    if (!navigator.geolocation) { setError("Location is unavailable in this browser."); return; }
    navigator.geolocation.getCurrentPosition(position => {
      startTransition(async () => {
        const result = await setProviderNearbyOriginAction(serviceId, { latitude: position.coords.latitude, longitude: position.coords.longitude });
        if (result.error) { setError(result.error); return; }
        setActive(true);
        setMessage("Nearby matching is enabled for this service.");
      });
    }, geoError => {
      setError(geoError.code === 1 ? "Location permission was denied. You can continue without nearby matching." : "Your location is unavailable right now. Try again from the service area.");
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 });
  };

  const disable = () => {
    setError(""); setMessage("");
    startTransition(async () => {
      const result = await setProviderNearbyOriginAction(serviceId, null);
      if (result.error) { setError(result.error); return; }
      setActive(false);
      setMessage("Nearby matching is off. Your saved matching origin was removed.");
    });
  };

  return <section className="mt-10 rounded border border-surface-200 bg-white p-5 sm:p-6" aria-labelledby="nearby-origin-heading">
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-800"><MapPin className="size-5" aria-hidden /></span>
      <div><h2 id="nearby-origin-heading" className="text-lg font-semibold text-navy-900">Nearby matching</h2><p className="mt-1 text-sm leading-6 text-surface-600">Opt in to appear when customers search near you. TrustLink stores the device location privately for distance calculations; customers see only your broad service area and a rounded distance.</p></div>
    </div>
    <div className="mt-4 flex items-start gap-2 rounded bg-surface-50 p-3 text-xs leading-5 text-surface-700"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden /><p>Your coordinates are never placed in public pages, profile data, URLs, or analytics. Saving service-area changes turns matching off until you opt in again.</p></div>
    {!eligible && <p className="mt-4 text-sm text-amber-800" role="status">Add an on-site area with a broad origin label and travel radius, then save the service before enabling nearby matching.</p>}
    {error && <p className="mt-4 border border-red-200 bg-danger-light p-3 text-sm font-medium text-danger-text" role="alert">{error}</p>}
    {message && <p className="mt-4 border border-teal-200 bg-teal-50 p-3 text-sm font-medium text-teal-900" role="status">{message}</p>}
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {active ? <Button type="button" variant="outline" loading={pending} onClick={disable}>Turn off nearby matching</Button> : <Button type="button" loading={pending} disabled={!eligible} onClick={enable}>Use my current location</Button>}
      <span className="text-xs font-medium text-surface-600">Status: {active ? "On" : "Off"}</span>
    </div>
  </section>;
}
