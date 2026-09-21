export function money(value: string, currency = "NGN") {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount) : value;
}
export function dateLabel(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(date);
}
