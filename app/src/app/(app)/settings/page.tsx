import Link from "next/link";
import { requireCompany } from "@/lib/auth";
import { COMPANY_TYPES } from "@/lib/company-setup";
import { Card, Flash, PageHeader, readParams, type SP } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { DeleteCompany } from "@/components/DeleteCompany";
import { companyContents } from "@/lib/company-delete";
import { saveCompany } from "../registers/actions";

type Field = { name: string; label: string; hint?: string; required?: boolean; type?: string; wide?: boolean };

const IDENTITY: Field[] = [
  { name: "name", label: "Registrerat företagsnamn *", hint: "Exakt som hos Bolagsverket (för enskild firma: ditt namn eller registrerat firmanamn).", required: true, wide: true },
  { name: "tradeName", label: "Varumärke / särskilt företagsnamn", hint: "Visas överst på fakturan om det skiljer sig från det registrerade namnet." },
  { name: "orgNumber", label: "Organisationsnummer *", hint: "Format 556677-8899 (personnummer för enskild firma).", required: true },
  { name: "vatNumber", label: "Momsregistreringsnummer", hint: "SE + organisationsnumret + 01, t.ex. SE556677889901." },
  { name: "seat", label: "Styrelsens säte (kommun)", hint: "Krävs på aktiebolags fakturor (28 kap. 5 § aktiebolagslagen)." },
];
const CONTACT: Field[] = [
  { name: "address", label: "Adress", wide: true },
  { name: "postalCode", label: "Postnummer" },
  { name: "city", label: "Ort" },
  { name: "email", label: "E-post", type: "email" },
  { name: "phone", label: "Telefon" },
  { name: "website", label: "Webbplats" },
  { name: "bankgiro", label: "Bankgiro" },
];

export default async function Settings({ searchParams }: { searchParams: SP }) {
  const { error, notice } = await readParams(searchParams);
  const { company: c, companyId, role } = await requireCompany();
  const contents = role === "owner" ? await companyContents(companyId) : null;
  const value = (k: string) => String(c[k as keyof typeof c] ?? "");
  const input = (f: Field) => (
    <div key={f.name} className={f.wide ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={f.name}>{f.label}</label>
      <input id={f.name} name={f.name} type={f.type ?? "text"} defaultValue={value(f.name)} required={f.required} className="input" />
      {f.hint && <p className="mt-1 text-[12px] text-muted">{f.hint}</p>}
    </div>
  );
  const typeLabel = COMPANY_TYPES[c.companyType as keyof typeof COMPANY_TYPES] ?? c.companyType;

  return (
    <>
      <PageHeader title="Företagsinställningar" subtitle="Uppgifterna hämtas automatiskt till dina fakturor. Utfärdade fakturor behåller uppgifterna som gällde då." />
      <Flash error={error} notice={notice} />
      <form action={saveCompany} className="grid max-w-5xl items-start gap-6 lg:grid-cols-2">
        <Card title="Företag">
          <div className="grid gap-4 px-5 pb-5 pt-1 sm:grid-cols-2">
            <p className="text-[13px] text-muted sm:col-span-2">
              Företagsform: <strong className="text-ink">{typeLabel}</strong> · Moms: <strong className="text-ink">{c.vatPeriod === "none" ? "ej momsregistrerat" : "momsregistrerat"}</strong> ·{" "}
              <Link href="/settings/fiscal" className="text-brand">Ändra</Link>
            </p>
            {IDENTITY.map(input)}
            <label className="flex items-start gap-2 text-[14px] sm:col-span-2">
              <input type="checkbox" name="fSkatt" defaultChecked={c.fSkatt} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
              <span>
                <span className="font-medium">Godkänd för F-skatt</span>
                <span className="block text-[12px] text-muted">Kryssa bara i om Skatteverket har godkänt företaget för F-skatt. Texten visas då på fakturan.</span>
              </span>
            </label>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Adress och kontakt">
            <div className="grid gap-4 px-5 pb-5 pt-1 sm:grid-cols-2">
              {CONTACT.map(input)}
              <p className="text-[12px] text-muted sm:col-span-2">
                Plusgiro, IBAN, Swish och logotyp ställer du in under <Link href="/invoices/design" className="text-brand">Fakturadesign</Link>.
              </p>
            </div>
          </Card>

          <Card title="Betalningsvillkor">
            <div className="grid gap-4 px-5 pb-5 pt-1 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="invoiceDays">Betalningsvillkor (dagar)</label>
                <input id="invoiceDays" name="invoiceDays" type="number" min={0} max={365} defaultValue={c.invoiceDays} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="lateInterestRate">Dröjsmålsränta (% per år)</label>
                <input id="lateInterestRate" name="lateInterestRate" inputMode="decimal" defaultValue={c.lateInterestRate ?? ""} placeholder="Enligt räntelagen" className="input" />
                <p className="mt-1 text-[12px] text-muted">Tomt = enligt räntelagen (referensräntan + 8 procentenheter). Ange en egen sats bara om den är avtalad.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="reminderFee">Påminnelseavgift (kr)</label>
                <input id="reminderFee" name="reminderFee" inputMode="decimal" defaultValue={c.reminderFee ? (c.reminderFee / 100).toString() : ""} placeholder="Ingen" className="input sm:w-40" />
                <p className="mt-1 text-[12px] text-muted">
                  Högst 60 kr, och får bara tas ut om den är avtalad med kunden i förväg (lagen om ersättning för inkassokostnader). Läggs aldrig till automatiskt – texten visas bara på fakturan.
                </p>
              </div>
              <div className="flex justify-end sm:col-span-2">
                <ConfirmButton>Spara</ConfirmButton>
              </div>
            </div>
          </Card>
        </div>
      </form>

      {contents && (
        <Card title="Radera företaget" className="mt-6 max-w-5xl">
          <div className="grid gap-6 px-5 pb-5 pt-1 text-[14px] lg:grid-cols-2">
            <div className="space-y-3">
              <p>
                Tar permanent bort {c.name} och allt som hör till det: {contents.verifications} verifikat, {contents.invoices} utfärdade fakturor, {contents.customers} kunder och {contents.uploads} underlag.
                {contents.users > 1 && ` ${contents.users - 1} andra användare förlorar tillgången.`} Det går inte att ångra. Ditt konto och dina andra företag påverkas inte.
              </p>
              {contents.verifications + contents.invoices > 0 && (
                <p className="rounded-xl bg-warn-soft p-3 text-warn">
                  Riktig bokföring ska sparas i sju år enligt bokföringslagen, så radera bara testdata eller bokföring du har en kopia av.{" "}
                  <Link href="/settings/import-export" className="font-semibold underline">Ladda ner SIE-fil</Link> och{" "}
                  <a href="/api/invoices/export" className="font-semibold underline">fakturaregister</a> först.
                </p>
              )}
            </div>
            <DeleteCompany id={companyId} name={c.name} />
          </div>
        </Card>
      )}
    </>
  );
}
