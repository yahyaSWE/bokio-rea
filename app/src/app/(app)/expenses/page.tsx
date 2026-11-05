import Link from "next/link";
import { db } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { dateStr, kr } from "@/lib/money";
import { Badge, Card, Empty, Flash, PageHeader, readParams, Stat, type SP } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ExpenseFields } from "@/components/ExpenseFields";
import { bookExpenseAction, createExpense, deleteExpense, payExpensesAction } from "./actions";

export default async function Expenses({ searchParams }: { searchParams: SP }) {
  const { companyId } = await requireCompany();
  const { error, notice } = await readParams(searchParams);
  const [expenses, accounts] = await Promise.all([
    db.expense.findMany({ where: { companyId }, include: { upload: true, verification: true, paymentVerification: true }, orderBy: { date: "desc" } }),
    db.account.findMany({ where: { companyId, active: true }, orderBy: { number: "asc" }, select: { number: true, name: true } }),
  ]);
  const pending = expenses.filter((e) => e.status === "pending");
  const unpaid = expenses.filter((e) => e.status === "booked");
  const paid = expenses.filter((e) => e.status === "paid");

  return (
    <>
      <PageHeader title="Utlägg" subtitle="När någon betalat för företaget med egna pengar" />
      <Flash error={error} notice={notice} />
      <div className="stat-group mb-6 grid sm:grid-cols-3">
        <Stat label="Att bokföra" value={kr(pending.reduce((s, e) => s + e.amount, 0))} hint={`${pending.length} st`} tone={pending.length ? "warn" : undefined} />
        <Stat label="Att betala ut" value={kr(unpaid.reduce((s, e) => s + e.amount, 0))} hint={`${unpaid.length} st`} />
        <Stat label="Utbetalt" value={kr(paid.reduce((s, e) => s + e.amount, 0))} hint={`${paid.length} st`} tone="brand" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Att bokföra">
            {pending.length === 0 ? (
              <Empty>Inga utlägg väntar på bokföring.</Empty>
            ) : (
              <ExpenseTable rows={pending} action={(e) => (
                <div className="flex justify-end gap-2">
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={e.id} />
                    <ConfirmButton className="btn-secondary" message="Ta bort utlägget?">Ta bort</ConfirmButton>
                  </form>
                  <form action={bookExpenseAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <ConfirmButton>Bokför</ConfirmButton>
                  </form>
                </div>
              )} />
            )}
          </Card>

          <Card title="Att betala ut">
            {unpaid.length === 0 ? (
              <Empty>Inget att betala ut.</Empty>
            ) : (
              <form action={payExpensesAction}>
                <ExpenseTable rows={unpaid} select />
                <div className="flex flex-wrap items-end justify-end gap-3 p-4">
                  <div>
                    <label className="label" htmlFor="paydate">Utbetalningsdatum</label>
                    <input id="paydate" type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
                  </div>
                  <ConfirmButton>Bokför utbetalning</ConfirmButton>
                </div>
              </form>
            )}
          </Card>

          {paid.length > 0 && (
            <Card title="Utbetalda">
              <ExpenseTable rows={paid} />
            </Card>
          )}
        </div>

        <Card title="Nytt utlägg">
          <form action={createExpense} className="grid gap-4 p-4 sm:grid-cols-2">
            <ExpenseFields accounts={accounts} />
            <p className="text-xs text-muted sm:col-span-2">
              Har du ett kvitto? <Link href="/uploads" className="text-brand">Ladda upp det</Link> och välj &quot;Registrera som utlägg&quot; så sparas det med utlägget.
            </p>
            <div className="flex justify-end sm:col-span-2">
              <ConfirmButton>Spara utlägg</ConfirmButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}

type Row = Awaited<ReturnType<typeof db.expense.findMany<{ include: { upload: true; verification: true; paymentVerification: true } }>>>[number];

function ExpenseTable({ rows, action, select }: { rows: Row[]; action?: (e: Row) => React.ReactNode; select?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            {select && <th className="w-8" />}
            <th>Datum</th>
            <th>Vem</th>
            <th>Beskrivning</th>
            <th className="num">Belopp</th>
            <th>{action ? "" : "Status"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              {select && (
                <td><input type="checkbox" name="ids" value={e.id} defaultChecked aria-label={`Betala ut ${e.description}`} /></td>
              )}
              <td className="whitespace-nowrap">{dateStr(e.date)}</td>
              <td>{e.employee}</td>
              <td>
                {e.description}
                {e.upload && (
                  <a href={`/api/files/${e.upload.id}`} target="_blank" className="ml-2 text-brand" title="Visa kvitto">📎</a>
                )}
                {e.verification && (
                  <Link href={`/verifications/${e.verification.id}`} className="ml-2 text-xs text-brand">
                    {e.verification.series}{e.verification.number}
                  </Link>
                )}
              </td>
              <td className="num">{kr(e.amount)}</td>
              <td>{action ? action(e) : <Badge status={e.status} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
