"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addProviderBlackoutAction,
  deleteProviderBlackoutAction,
  saveProviderAvailabilityAction,
} from "@/app/actions/provider-marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProviderAvailabilityRule, ProviderBlackout } from "@/lib/domain/provider-marketplace";

const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
type DayDraft = { enabled: boolean; start: string; end: string };

function lagosIso(value: string) {
  const timestamp = Date.parse(`${value}:00+01:00`);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function localDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(value));
}

export function AvailabilityForm({ rules, blackouts }: { rules: ProviderAvailabilityRule[]; blackouts: ProviderBlackout[] }) {
  const router = useRouter();
  const [schedule, setSchedule] = useState<DayDraft[]>(() => days.map((_, dayOfWeek) => {
    const rule = rules.find(candidate => candidate.dayOfWeek === dayOfWeek && !candidate.providerServiceId);
    return { enabled: Boolean(rule), start: rule?.localStart || "09:00", end: rule?.localEnd || "17:00" };
  }));
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [blackoutError, setBlackoutError] = useState("");
  const [blackoutMessage, setBlackoutMessage] = useState("");
  const [schedulePending, startScheduleTransition] = useTransition();
  const [blackoutPending, startBlackoutTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  const updateDay = (day: number, patch: Partial<DayDraft>) => setSchedule(current => current.map((entry,index) => index === day ? { ...entry, ...patch } : entry));

  return <div className="space-y-12">
    <form className="space-y-6" onSubmit={event => {
      event.preventDefault();
      const input = schedule.flatMap((entry, dayOfWeek) => entry.enabled ? [{
        dayOfWeek,
        localStart: entry.start,
        localEnd: entry.end,
        timezone: "Africa/Lagos",
      }] : []);
      setScheduleError(""); setScheduleMessage("");
      startScheduleTransition(async () => {
        try {
          const result = await saveProviderAvailabilityAction(input);
          if (result.error) { setScheduleError(result.error); return; }
          setScheduleMessage("Weekly availability saved.");
          router.refresh();
        } catch { setScheduleError("Connection interrupted. Please try again."); }
      });
    }}>
      <div><h2 className="text-lg font-semibold text-navy-900">Weekly availability</h2><p className="mt-1 text-sm leading-6 text-surface-600">Set your normal working hours in West Africa Time (Africa/Lagos). Customers do not see your private blackout notes.</p></div>
      <div className="divide-y divide-surface-200 rounded border border-surface-200">
        {days.map((day,index) => <div className="grid items-center gap-3 p-4 sm:grid-cols-[9rem_1fr_1fr]" key={day}>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-navy-900"><input type="checkbox" checked={schedule[index].enabled} onChange={event => updateDay(index,{ enabled:event.target.checked })} />{day}</label>
          <Input aria-label={`${day} start time`} type="time" value={schedule[index].start} onChange={event => updateDay(index,{ start:event.target.value })} disabled={!schedule[index].enabled} required={schedule[index].enabled} />
          <Input aria-label={`${day} end time`} type="time" value={schedule[index].end} onChange={event => updateDay(index,{ end:event.target.value })} disabled={!schedule[index].enabled} required={schedule[index].enabled} />
        </div>)}
      </div>
      {scheduleError && <p className="border border-red-200 bg-danger-light p-3 text-sm font-medium text-danger-text" role="alert">{scheduleError}</p>}
      {scheduleMessage && <p className="border border-teal-200 bg-teal-50 p-3 text-sm font-medium text-teal-900" role="status">{scheduleMessage}</p>}
      <Button type="submit" loading={schedulePending}>Save weekly hours</Button>
    </form>

    <section className="space-y-6 border-t border-surface-200 pt-10" aria-labelledby="blackout-heading">
      <div><h2 id="blackout-heading" className="text-lg font-semibold text-navy-900">Time off and blackout periods</h2><p className="mt-1 text-sm leading-6 text-surface-600">Block dates when you cannot accept work. Times are interpreted in Africa/Lagos.</p></div>
      <form className="grid gap-5 rounded border border-surface-200 bg-surface-50 p-5 sm:grid-cols-2" onSubmit={event => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const startsAt = lagosIso(String(values.get("blackoutStart") || ""));
        const endsAt = lagosIso(String(values.get("blackoutEnd") || ""));
        setBlackoutError(""); setBlackoutMessage("");
        startBlackoutTransition(async () => {
          try {
            const result = await addProviderBlackoutAction({ startsAt, endsAt, reason: values.get("reason") });
            if (result.error) { setBlackoutError(result.error); return; }
            form.reset();
            setBlackoutMessage("Blackout period added.");
            router.refresh();
          } catch { setBlackoutError("Connection interrupted. Please try again."); }
        });
      }}>
        <Input name="blackoutStart" label="Starts" type="datetime-local" required />
        <Input name="blackoutEnd" label="Ends" type="datetime-local" required />
        <div className="sm:col-span-2"><Input name="reason" label="Private note (optional)" maxLength={500} placeholder="Annual leave" hint="This note is never included in the public marketplace projection." /></div>
        {blackoutError && <p className="sm:col-span-2 border border-red-200 bg-danger-light p-3 text-sm font-medium text-danger-text" role="alert">{blackoutError}</p>}
        {blackoutMessage && <p className="sm:col-span-2 border border-teal-200 bg-teal-50 p-3 text-sm font-medium text-teal-900" role="status">{blackoutMessage}</p>}
        <div className="sm:col-span-2"><Button type="submit" loading={blackoutPending}>Add blackout period</Button></div>
      </form>

      <div className="space-y-3">
        {blackouts.length === 0 ? <p className="text-sm text-surface-600">No blackout periods have been added.</p> : blackouts.map(blackout => <article key={blackout.id} className="flex flex-col justify-between gap-4 rounded border border-surface-200 p-4 sm:flex-row sm:items-center">
          <div><p className="text-sm font-semibold text-navy-900">{localDateTime(blackout.startsAt)} – {localDateTime(blackout.endsAt)}</p><p className="mt-1 text-xs text-surface-600">{blackout.reason || "No private note"} · {blackout.source === "MANUAL" ? "Manual" : "Reserved by the system"}</p></div>
          {blackout.source === "MANUAL" && <Button type="button" variant="ghost" size="sm" loading={deletePending} onClick={() => {
            setBlackoutError("");
            startDeleteTransition(async () => {
              try {
                const result = await deleteProviderBlackoutAction(blackout.id);
                if (result.error) { setBlackoutError(result.error); return; }
                router.refresh();
              } catch { setBlackoutError("Connection interrupted. Please try again."); }
            });
          }}>Remove</Button>}
        </article>)}
      </div>
    </section>
  </div>;
}
