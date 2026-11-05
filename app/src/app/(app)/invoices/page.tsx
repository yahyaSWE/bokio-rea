import Link from "next/link";
import { db } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { invoiceTotals } from "@/lib/accounting";
import { dateStr, kr } from "@/lib/money";
import { displayStatus } from "@/lib/invoice-status";
import { Badge, Card, Empty, Flash, PageHeader, readParams, Segmented, Stat, type SP } from "@/components/ui";

const FILTERS = [
  ["all", "Alla"],
  ["draft", "Utkast"],
  ["sent", "Obetalda"],
  ["overdue", "Förfallna"],
  ["paid", "Betalda"],
  ["credited", "Krediterade"],
] as const;

export default async function Invoices({ searchParams }: { searchParams: SP }) {
  const { companyId } = await requireCompany();
  const { get, error, notice } = await readParams(searchParams);
  const filter = get("status") ?? "all";
  const all = await db.invoice.findMany({
    where: { companyId },
    include: { customer: true, lines: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  const rows = all.map((i) => ({ ...i, total: invoiceTotals(i.lines).total, shown: displayStatus(i) }));
  const sum = (s: string[]) => rows.filter((r) => s.includes(r.shown)).reduce((a, r) => a + r.total, 0);
  const list = rows.filter(
    (r) => filter === "all" || r.shown === filter || (filter === "sent" && r.shown === "overdue") || (filter === "credited" && r.shown === "credit"),
  );

  return (
    <>
      <PageHeader title="Fakturor" actions={
          <>
            <a href="/api/invoices/export" className="btn-secondary">Exportera fakturaregister</a>
            <Link href="/invoices/new" className="btn-primary">Ny faktura</Link>
          </>
        } />
      <Flash error={error} notice={notice} />
      <div className="stat-group mb-6 grid sm:grid-cols-3">
        <Stat label="Obetalt (inkl. moms)" value={kr(sum(["sent", "overdue"]))} />
        <Stat label="Förfallet (inkl. moms)" value={kr(sum(["overdue"]))} tone={sum(["overdue"]) ? "danger" : undefined} />
        <Stat label="Betalt i år (inkl. moms)" value={kr(rows.filter((r) => r.status === "paid" && r.paidDate && r.paidDate.getUTCFullYear() === new Date().getUTCFullYear()).reduce((a, r) => a + r.total, 0))} tone="success" />
      </div>
      <Card>
        <div className="px-4 pb-3 pt-4">
          <Segmented active={filter} items={FILTERS.map(([key, label]) => ({ key, label, href: `/invoices?status=${key}` }))} />
        </div>
        {list.length === 0 ? (
          <Empty href="/invoices/new" cta="Skapa faktura">Inga fakturor här.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nr</th>
                  <th>Kund</th>
                  <th>Fakturadatum</th>
                  <th className="hidden md:table-cell">Förfaller</th>
                  <th>Status</th>
                  <th className="num">Belopp inkl. moms</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/invoices/${i.id}`} className="font-medium text-brand">{i.number ?? "–"}</Link>
                    </td>
                    <td>
                      <Link href={`/invoices/${i.id}`} className="hover:underline">{i.customer.name}</Link>
                    </td>
                    <td className="whitespace-nowrap">{dateStr(i.date)}</td>
                    <td className="hidden whitespace-nowrap md:table-cell">{dateStr(i.dueDate)}</td>
                    <td><Badge status={i.shown} /></td>
                    <td className="num">{kr(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
