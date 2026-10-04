import Link from "next/link";
import Image from "next/image";
import brandIcon from "@/app/icon.png";
import { cn } from "@/lib/utils";
type Props = { className?: string; variant?: "mark" | "full" | "stacked"; href?: string | null; size?: "sm" | "md" | "lg"; theme?: "light" | "dark" };
export function LogoMark({ className, size = "md" }: Pick<Props,"className" | "size">) {
  return <span className={cn("brand-mark relative inline-block shrink-0 overflow-hidden", size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-9 w-9", className)} aria-hidden="true">
    <Image src={brandIcon} alt="" unoptimized priority className="brand-mark-image"/>
  </span>;
}
export function LogoWordmark({ className }: Pick<Props,"className" | "size">) { return <span className={cn("text-[1.32rem] font-semibold tracking-[-0.055em] leading-none",className)}>TrustLink</span>; }
export function Logo({ className, variant = "full", href = "/", size = "md", theme = "light" }: Props) {
  const content = <><LogoMark size={size}/>{variant !== "mark" && <LogoWordmark/>}</>;
  const classes = cn("inline-flex items-center gap-2.5 shrink-0",variant === "stacked" && "flex-col",theme === "dark" ? "text-white" : "text-navy-900",className);
  return href === null ? <span className={classes}>{content}</span> : <Link href={href} className={classes} aria-label="TrustLink home">{content}</Link>;
}
