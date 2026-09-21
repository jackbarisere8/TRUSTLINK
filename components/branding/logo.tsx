import Link from "next/link";
import { cn } from "@/lib/utils";
type Props = { className?: string; variant?: "mark" | "full" | "stacked"; href?: string | null; size?: "sm" | "md" | "lg"; theme?: "light" | "dark" };
export function LogoMark({ className, size = "md" }: Pick<Props,"className" | "size">) {
  return <svg className={cn(size === "sm" ? "h-6 w-6" : size === "lg" ? "h-10 w-10" : "h-8 w-8", className)} viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M13 8H8a5 5 0 0 0-5 5v6a5 5 0 0 0 5 5h5M19 8h5a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-5M10 16h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>;
}
export function LogoWordmark({ className }: Pick<Props,"className" | "size">) { return <span className={cn("text-xl font-semibold tracking-tight",className)}>TrustLink</span>; }
export function Logo({ className, variant = "full", href = "/", size = "md", theme = "light" }: Props) {
  const content = <><LogoMark size={size}/>{variant !== "mark" && <LogoWordmark/>}</>;
  const classes = cn("inline-flex items-center gap-2 shrink-0",theme === "dark" ? "text-white" : "text-navy-900",className);
  return href === null ? <span className={classes}>{content}</span> : <Link href={href} className={classes} aria-label="TrustLink home">{content}</Link>;
}
