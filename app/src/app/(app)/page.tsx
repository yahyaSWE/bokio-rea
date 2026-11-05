import Link from "next/link";
import { db } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { balances, invoiceTotals, sumRange } from "@/lib/accounting";
import { kr } from "@/lib/money";
import { periodLabel, vatPeriods, vatReport } from "@/lib/vat";
import { currentFiscalYear, fyLabel } from "@/lib/fiscal";
import { Card, Flash, PageHeader, readParams, Stat, type SP } from "@/components/ui";
import { BarChart } from "@/components/BarChart";

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const { notice } = await readParams(searchParams);
  const { companyId } = await requireCompany();
  const now = new Date();
  // Räkenskapsåret och momsperioden som pågår idag.
  const [fy, periods] = await Promise.all([currentFiscalYear(companyId), vatPeriods(companyId)]);
  const yearStart = fy.start;
  const vatPeriod = periods.find((p) => p.current) ?? null;
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  // Alla frågor körs parallellt; varje databasrundresa kostar tid, särskilt i serverless.
  const [yearBal, allBal, openInvoices, toBook, pendingExpenses, drafts, vat, lines, bankToBook] = await Promise.all([
    balances(companyId, { from: yearStart, to: now }),
    balances(companyId),
    db.invoice.findMany({ where: { companyId, status: "sent" }, include: { lines: true } }),
    db.upload.count({ where: { companyId, verificationId: null, expense: null } }),
    db.expense.count({ where: { companyId, status: "pending" } }),
    db.invoice.count({ where: { companyId, status: "draft" } }),
    vatPeriod ? vatReport(companyId, vatPeriod.start, vatPeriod.end) : null,
    // Inkomster och kostnader per månad, senaste 12 månaderna.
    db.verificationLine.findMany({
      where: { companyId, accountNumber: { gte: 3000, lte: 8989 }, verification: { date: { gte: from } } },
      select: { debit: true, credit: true, accountNumber: true, verification: { select: { date: true } }, account: { select: { name: true } } },
    }),
    db.bankTransaction.count({ where: { companyId, status: "new" } }),
  ]);
  const result = -sumRange(yearBal, 3000, 8989);
  const bank = sumRange(allBal, 1900, 1999);
  const unpaid = openInvoices.reduce((s, i) => s + invoiceTotals(i.lines).total, 0);
  const overdue = openInvoices.filter((i) => i.dueDate < now).reduce((s, i) => s + invoiceTotals(i.lines).total, 0);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("sv-SE", { month: "short", timeZone: "UTC" }), income: 0, cost: 0 };
  });
  const costs = new Map<string, number>();
  for (const l of lines) {
    const m = months.find((x) => x.key === l.verification.date.toISOString().slice(0, 7));
    const amount = l.debit - l.credit;
    if (l.accountNumber < 4000) {
      if (m) m.income -= amount;
    } else {
      if (m) m.cost += amount;
      costs.set(l.account.name, (costs.get(l.account.name) ?? 0) + amount);
    }
  }
  const topCosts = [...costs.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const income12 = months.reduce((s, m) => s + m.income, 0);
  const cost12 = months.reduce((s, m) => s + m.cost, 0);

  const todos = [
    bankToBook > 0 && { href: "/bank", text: `${bankToBook} banktransaktioner att bokföra` },
    toBook > 0 && { href: "/uploads", text: `${toBook} underlag att bokföra` },
    pendingExpenses > 0 && { href: "/expenses", text: `${pendingExpenses} utlägg att bokföra` },
    drafts > 0 && { href: "/invoices?status=draft", text: `${drafts} fakturautkast` },
    overdue > 0 && { href: "/invoices?status=overdue", text: `Förfallna fakturor på ${kr(overdue)}` },
  ].filter(Boolean) as { href: string; text: string }[];

  return (
    <>
      <PageHeader
        title="Översikt"
        subtitle={`Räkenskapsår ${fyLabel(fy)}`}
        actions={
          <>
            <Link href="/uploads" className="btn-secondary">Ladda upp underlag</Link>
            <Link href="/invoices/new" className="btn-primary">Ny faktura</Link>
          </>
        }
      />

      <Flash notice={notice} />
      <div className="stat-group grid sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Årets resultat" value={kr(result)} tone={result < 0 ? "danger" : undefined} />
        <Stat label="Saldo bank och kassa" value={kr(bank)} hint="Enligt bokföringen (19xx)" />
        <Stat label="Obetalda kundfakturor" value={kr(unpaid)} hint={overdue ? `varav förfallet ${kr(overdue)}` : "Inget förfallet"} tone={overdue ? "warn" : undefined} />
        <Stat
          label={vatPeriod ? `Preliminär moms, ${periodLabel(vatPeriod)}` : "Moms"}
          value={vat ? kr(Math.abs(vat.toPay)) : "–"}
          hint={vat ? (vat.toPay >= 0 ? "Att betala" : "Att få tillbaka") : "Ej momsregistrerat"}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Inkomster och kostnader, senaste 12 månaderna" className="xl:col-span-2">
          <div className="p-5">
            <div className="mb-4 flex flex-wrap gap-8">
              <span className="text-[13px] text-muted">Inkomster<strong className="mt-0.5 block text-[18px] font-medium tabular-nums tracking-[-0.02em] text-ink">{kr(income12, { decimals: false })}</strong></span>
              <span className="text-[13px] text-muted">Kostnader<strong className="mt-0.5 block text-[18px] font-medium tabular-nums tracking-[-0.02em] text-ink">{kr(cost12, { decimals: false })}</strong></span>
            </div>
            <BarChart data={months.map((m) => ({ label: m.label, a: m.income / 100, b: m.cost / 100 }))} aLabel="Inkomster" bLabel="Kostnader" />
          </div>
        </Card>

        <Card title="Att göra">
          {todos.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Inget att göra just nu.</p>
          ) : (
            <ul className="divide-y divide-line">
              {todos.map((t) => (
                <li key={t.href}>
                  <Link href={t.href} className="group flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-2">
                    {t.text}
                    <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-ink">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Största kostnader, senaste 12 månaderna" className="xl:col-span-2" action={<Link href="/reports/result" className="text-[13px] text-muted hover:text-ink">Resultatrapport →</Link>}>
          {topCosts.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">Inga kostnader bokförda ännu.</p>
          ) : (
            <ul className="space-y-3.5 p-5">
              {topCosts.map(([name, v]) => (
                <li key={name} className="text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="truncate">{name}</span>
                    <span className="tabular-nums">{kr(v, { decimals: false })}</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-fill">
                    <div className="h-1 rounded-full bg-ink/70" style={{ width: `${(v / topCosts[0][1]) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Snabbval">
          <ul className="divide-y divide-line">
            {[
              ["/verifications/new", "Nytt verifikat"],
              ["/expenses", "Registrera utlägg"],
              ["/vat", "Momsredovisning"],
              ["/reports/balance", "Balansrapport"],
            ].map(([href, text]) => (
              <li key={href}>
                <Link href={href} className="group flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-2">
                  {text}
                  <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-ink">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
