import Link from "next/link";
import { kr } from "@/lib/money";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.025em] sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {title && (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "warn" | "brand" | "success" }) {
  // Färg används sparsamt: bara röda belopp när något är fel, övriga signaler som en prick vid etiketten.
  // Placeras i en .stat-group (sammanhållen panel med hårfina linjer mellan nyckeltalen).
  const dot = tone ? { danger: "bg-danger", warn: "bg-warn", brand: "bg-brand", success: "bg-success" }[tone] : "";
  return (
    <div className="bg-surface px-5 py-4">
      <p className="flex items-center gap-2 text-[13px] text-muted">
        {dot && <i aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
        {label}
      </p>
      <p className={`mt-2 text-[24px] font-medium tabular-nums leading-tight tracking-[-0.03em] ${tone === "danger" ? "text-danger" : ""}`}>{value}</p>
      {hint && <p className={`mt-1 text-[13px] ${tone === "warn" ? "text-warn" : "text-muted"}`}>{hint}</p>}
    </div>
  );
}

const BADGE: Record<string, [string, string]> = {
  draft: ["Utkast", "bg-fill text-muted"],
  sent: ["Obetald", "bg-warn-soft text-warn"],
  overdue: ["Förfallen", "bg-danger-soft text-danger"],
  paid: ["Betald", "bg-success-soft text-success"],
  credited: ["Krediterad", "bg-fill text-muted"],
  credit: ["Kreditfaktura", "bg-fill text-muted"],
  pending: ["Att bokföra", "bg-warn-soft text-warn"],
  booked: ["Ej utbetald", "bg-brand-soft text-brand"],
  locked: ["Låst", "bg-success-soft text-success"],
  open: ["Pågår", "bg-fill text-muted"],
  late: ["Försenad", "bg-danger-soft text-danger"],
  todo: ["Att deklarera", "bg-warn-soft text-warn"],
  reversed: ["Makulerad", "bg-danger-soft text-danger"],
};

export function Badge({ status }: { status: string }) {
  const [label, cls] = BADGE[status] ?? [status, "bg-fill text-muted"];
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-medium ${cls}`}>{label}</span>;
}

export function Flash({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`mb-6 flex items-start gap-3 rounded-lg px-4 py-3 text-[14px] ${error ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}
    >
      <span aria-hidden className="mt-px font-bold">{error ? "!" : "✓"}</span>
      <span className="font-medium">{error ?? notice}</span>
    </div>
  );
}

export function Money({ ore, className = "" }: { ore: number; className?: string }) {
  return <span className={`num ${ore < 0 ? "text-danger" : ""} ${className}`}>{kr(ore)}</span>;
}

export function Empty({ children, href, cta }: { children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <div className="px-5 py-12 text-center text-[14px] text-muted">
      <p>{children}</p>
      {href && (
        <Link href={href} className="btn-primary mt-4">
          {cta}
        </Link>
      )}
    </div>
  );
}

/** Segmenterad kontroll för filter och flikar (länkar). */
export function Segmented({ items, active, className = "" }: { items: { key: string; label: string; href: string }[]; active: string; className?: string }) {
  return (
    <nav className={`segmented ${className}`}>
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={i.key === active ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export type SP = Promise<Record<string, string | string[] | undefined>>;

export async function readParams(sp: SP) {
  const p = await sp;
  const get = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  return { get, error: get("error"), notice: get("ok") };
}
