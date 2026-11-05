"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout, switchCompany } from "@/app/(auth)/actions";
import { Icon, type IconName } from "./Icon";

const NAV: { title?: string; items: [string, string, IconName][] }[] = [
  {
    items: [
      ["/", "Översikt", "home"],
      ["/uploads", "Uppladdat", "tray"],
    ],
  },
  {
    title: "Bokföring",
    items: [
      ["/verifications", "Bokfört", "book"],
      ["/verifications/new", "Bokför", "plus"],
      ["/bank", "Bank", "bank"],
      ["/vat", "Momsredovisning", "percent"],
      ["/closing", "Bokslut", "check"],
    ],
  },
  {
    title: "Försäljning",
    items: [
      ["/invoices", "Fakturor", "doc"],
      ["/customers", "Kunder", "people"],
      ["/articles", "Artiklar", "tag"],
      ["/invoices/design", "Fakturadesign", "palette"],
    ],
  },
  { title: "Utgifter", items: [["/expenses", "Utlägg", "card"]] },
  {
    title: "Rapporter",
    items: [
      ["/reports/result", "Resultatrapport", "chart"],
      ["/reports/balance", "Balansrapport", "scale"],
      ["/reports/ledger", "Huvudbok", "list"],
    ],
  },
  {
    title: "Inställningar",
    items: [
      ["/settings", "Företag", "building"],
      ["/settings/fiscal", "Räkenskapsår och moms", "calendar"],
      ["/settings/accounts", "Kontoplan", "grid"],
      ["/settings/templates", "Bokföringsmallar", "wand"],
      ["/settings/import-export", "Import och export", "upload"],
      ["/settings/users", "Användare och behörighet", "people"],
      ["/settings/connections", "Kopplingar (Claude)", "plug"],
      ["/settings/inbox", "Kvitton via e-post", "tray"],
      ["/settings/appearance", "Utseende", "sun"],
    ],
  },
];

const ALL = NAV.flatMap((g) => g.items.map(([h]) => h));

/** Den längsta menylänk som matchar sökvägen är aktiv. */
function activeHref(path: string) {
  return ALL.filter((h) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"))).sort((a, b) => b.length - a.length)[0];
}

type C = { id: number; name: string };

// Sidor för att lägga till bokföring döljs för användare med läsbehörighet.
const WRITE_ONLY = new Set(["/verifications/new"]);

export function Sidebar({ company, companies, userName, readOnly = false }: { company: C; companies: C[]; userName: string; readOnly?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Markera den klickade länken direkt, innan nästa sida hunnit laddas.
  const [pending, setPending] = useState<string | null>(null);
  const active = pending ?? activeHref(path);
  const current = NAV.flatMap((g) => g.items).find(([h]) => h === active)?.[1] ?? "Huvudbok";

  useEffect(() => {
    setOpen(false);
    setPending(null);
  }, [path]);

  return (
    <>
      {/* Mobil: genomskinlig toppmeny */}
      <header className="no-print sticky top-0 z-30 flex h-12 items-center justify-between border-b border-[var(--sidebar-border)] bg-[var(--sidebar)] px-4 backdrop-blur-xl backdrop-saturate-150 md:hidden">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-[15px] font-medium text-ink" aria-expanded={open}>
          <Icon name="sidebar" className="h-5 w-5" />
          Meny
        </button>
        <span className="text-[15px] font-semibold">{current}</span>
        <span className="w-14" />
      </header>

      {open && <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] md:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] backdrop-blur-2xl backdrop-saturate-150 transition-transform duration-300 ease-out md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${open ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
      >
        <div className="px-4 pb-3 pt-5">
          <Link href="/" className="mb-4 flex items-center gap-2.5 px-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary font-mono text-[13px] font-semibold text-primary-ink">H</span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Huvudbok</span>
          </Link>
          <form action={switchCompany}>
            <label className="sr-only" htmlFor="company-switch">Företag</label>
            <select
              key={company.id}
              id="company-switch"
              name="companyId"
              defaultValue={company.id}
              onChange={(e) => {
                if (e.target.value === "new") window.location.href = "/companies/new";
                else e.target.form?.requestSubmit();
              }}
              className="input py-1.5 text-[13px] font-medium"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="new">Lägg till företag…</option>
            </select>
          </form>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {NAV.map((group, i) => (
            <div key={i}>
              {group.title && <p className="mb-1 px-2.5 text-[12px] font-medium text-muted">{group.title}</p>}
              <ul className="space-y-px">
                {group.items.filter(([href]) => !(readOnly && WRITE_ONLY.has(href))).map(([href, label, icon]) => {
                  const on = active === href;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={on ? "page" : undefined}
                        onClick={(e) => {
                          if (!e.metaKey && !e.ctrlKey && href !== activeHref(path)) setPending(href);
                        }}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[14px] transition-colors ${on ? "bg-surface font-medium text-ink shadow-[var(--shadow-raised)]" : "text-ink/75 hover:bg-fill hover:text-ink"}`}
                      >
                        <Icon name={icon} className={`h-[17px] w-[17px] shrink-0 ${on ? "text-brand" : "text-muted"}`} />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 border-t border-line px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill text-[13px] font-semibold text-ink">
            {userName.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{userName}</p>
            <form action={logout}>
              <button className="text-[12px] text-muted hover:text-ink">Logga ut</button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
