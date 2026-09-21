import { eventLabels } from "@/lib/trust-events";
import { dateLabel } from "@/lib/format";
export function Timeline({ events }: { events: { id: string; eventType: string; occurredAt: string }[] }) {
  return <section className="mt-8 pt-8 border-t border-surface-200"><h2 className="text-base font-semibold mb-5">Transaction history</h2>{events.length ? <ol className="border-l border-surface-200 ml-1 space-y-5">{events.map(e => <li key={e.id} className="relative pl-5 text-sm"><span aria-hidden="true" className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-surface-400"/><span>{eventLabels[e.eventType] || e.eventType.replaceAll("_"," ").toLowerCase()}</span><time className="block text-xs text-surface-500 mt-1" dateTime={e.occurredAt}>{dateLabel(e.occurredAt)}</time></li>)}</ol> : <p className="text-sm text-surface-500">No events recorded yet.</p>}</section>;
}
