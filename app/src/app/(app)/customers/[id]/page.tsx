import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { invoiceTotals } from "@/lib/accounting";
import { dateStr, kr } from "@/lib/money";
import { displayStatus } from "@/lib/invoice-status";
import { countryName } from "@/lib/invoice-doc";
import { Badge, Card, Empty, Money, PageHeader, Stat } from "@/components/ui";

type Link_ = { key: string; date: Date; title: string; detail: string; href: string; amount: number };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { companyId } = await requireCompany();
  const { id } = await params;
  const customer = await db.customer.findFirst({
    where: { id: Number(id) || -1, companyId },
    include: {
      invoices: {
        include: {
          lines: true,
          verification: { select: { id: true, series: true, number: true, date: true, reversedById: true } },
          paymentVerification: {
            select: { id: true, series: true, number: true, date: true, reversedById: true, bankTransactions: { select: { id: true, date: true, text: true } } },
          },
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      },
    },
  });
  if (!customer) notFound();

  const invoices = customer.invoices.map((i) => ({ ...i, total: invoiceTotals(i.lines).total, shown: displayStatus(i) }));
  const issued = invoices.filter((i) => i.status !== "draft");
  const sum = (list: typeof invoices) => list.reduce((s, i) => s + i.total, 0);
  const unpaid = invoices.filter((i) => i.shown === "sent" || i.shown === "overdue");
  const overdue = invoices.filter((i) => i.shown === "overdue");

  // Kopplingar i bokföringen: fakturans verifikat, betalningens verifikat och bankraden betalningen matchades mot.
  const links: Link_[] = [];
  for (const i of invoices) {
    if (i.verification) {
      const v = i.verification;
      links.push({ key: `v${v.id}`, date: v.date, title: `${v.series}${v.number} · Faktura #${i.number} bokförd`, detail: v.reversedById ? "Makulerad" : "Kundfordran och intäkt", href: `/verifications/${v.id}`, amount: i.total });
    }
    if (i.paymentVerification) {
      const v = i.paymentVerification;
      links.push({ key: `p${v.id}`, date: v.date, title: `${v.series}${v.number} · Betalning av faktura #${i.number}`, detail: v.reversedById ? "Makulerad" : "Inbetalning", href: `/verifications/${v.id}`, amount: i.total });
      for (const b of v.bankTransactions) {
        links.push({ key: `b${b.id}`, date: b.date, title: `Bankrad ${dateStr(b.date)} · ${b.text}`, detail: `Matchad mot faktura #${i.number}`, href: "/bank?tab=booked", amount: i.total });
      }
    }
  }
  links.sort((a, b) => b.date.getTime() - a.date.getTime());

  const info: [string, React.ReactNode][] = [
    ["Org.nr / personnr", customer.orgNumber],
    ["Momsreg.nr", customer.vatNumber],
    ["Land", countryName(customer.country)],
    ["E-post", customer.email && <a href={`mailto:${customer.email}`} className="text-brand">{customer.email}</a>],
    ["Referens", customer.reference],
    ["Adress", [customer.address, [customer.postalCode, customer.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")],
  ];

  return (
    <>
      <div className="mb-3 text-[14px]">
        <Link href="/customers" className="text-brand">‹ Kunder</Link>
      </div>
      <PageHeader
        title={customer.name}
        subtitle={[customer.orgNumber, customer.city].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Link href={`/customers?edit=${customer.id}`} className="btn-secondary">Ändra</Link>
            <Link href={`/invoices/new?customer=${customer.id}`} className="btn-primary">Ny faktura</Link>
          </>
        }
      />

      <div className="stat-group mb-6 grid sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Fakturor" value={String(issued.filter((i) => i.kind !== "credit").length)} hint={invoices.length > issued.length ? `+ ${invoices.length - issued.length} utkast` : undefined} />
        <Stat label="Fakturerat (inkl. moms)" value={kr(sum(issued.filter((i) => i.status !== "credited" && i.kind !== "credit")))} />
        <Stat label="Obetalt" value={kr(sum(unpaid))} tone={unpaid.length ? "warn" : undefined} hint={unpaid.length ? `${unpaid.length} ${unpaid.length === 1 ? "faktura" : "fakturor"}` : "Inget obetalt"} />
        <Stat label="Förfallet" value={kr(sum(overdue))} tone={overdue.length ? "danger" : undefined} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title={`Fakturor (${invoices.length})`}>
            {invoices.length === 0 ? (
              <Empty href={`/invoices/new?customer=${customer.id}`} cta="Skapa faktura">Inga fakturor till kunden ännu.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nr</th>
                      <th>Datum</th>
                      <th className="hidden md:table-cell">Förfaller</th>
                      <th>Status</th>
                      <th className="num">Belopp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <Link href={`/invoices/${i.id}`} className="font-medium text-brand">
                            {i.number ? `${i.kind === "credit" ? "Kredit " : ""}#${i.number}` : "Utkast"}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap tabular-nums">{dateStr(i.date)}</td>
                        <td className="hidden whitespace-nowrap tabular-nums md:table-cell">{dateStr(i.dueDate)}</td>
                        <td><Badge status={i.shown} /></td>
                        <td><Money ore={i.total} className="block" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={`Kopplingar i bokföringen (${links.length})`}>
            {links.length === 0 ? (
              <p className="px-5 pb-5 pt-1 text-[14px] text-muted">Inga verifikat eller bankrader är kopplade till kunden ännu.</p>
            ) : (
              <ul className="divide-y divide-line">
                {links.map((l) => (
                  <li key={l.key}>
                    <Link href={l.href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
                      <span className="w-[5.5rem] shrink-0 text-[13px] tabular-nums text-muted">{dateStr(l.date)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{l.title}</span>
                        <span className="block text-[12px] text-muted">{l.detail}</span>
                      </span>
                      <Money ore={l.amount} className="shrink-0 text-[14px]" />
                      <span aria-hidden className="text-muted">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Uppgifter" action={<Link href={`/customers?edit=${customer.id}`} className="text-sm text-brand">Ändra</Link>}>
          <dl className="divide-y divide-line px-5 pb-2 text-[14px]">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="min-w-0 break-words text-right">{v || <span className="text-muted">–</span>}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
