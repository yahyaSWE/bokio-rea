"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner, requireWriter } from "@/lib/auth";
import { deleteCompany } from "@/lib/company-delete";
import { validOrgNumber } from "@/lib/company-setup";
import { MAX_REMINDER_FEE, formatVatNumber, validSwedishVatNumber, validVatNumberFormat, vatMatchesOrg } from "@/lib/invoice-rules";
import { str, withParam } from "@/lib/action";
import { parseKr } from "@/lib/money";

function done(path: string, msg: string): never {
  revalidatePath("/", "layout");
  redirect(withParam(path, "ok", msg));
}

export async function saveCustomer(fd: FormData) {
  const { companyId } = await requireWriter();
  const id = Number(str(fd, "id"));
  const name = str(fd, "name");
  const back = id ? `/customers?edit=${id}` : "/customers";
  if (!name) redirect(withParam(back, "error", "Kunden måste ha ett namn."));
  const orgNumber = str(fd, "orgNumber");
  const vatNumber = formatVatNumber(str(fd, "vatNumber"));
  const country = str(fd, "country").toUpperCase() || "SE";
  // Svenska organisations-/personnummer kontrolleras med kontrollsiffran; utländska nummer sparas som de är.
  if (/^[\d\s-]+$/.test(orgNumber) && orgNumber && !validOrgNumber(orgNumber)) redirect(withParam(back, "error", `Organisations-/personnumret ${orgNumber} är inte giltigt.`));
  if (vatNumber && !validVatNumberFormat(vatNumber)) redirect(withParam(back, "error", `Momsregistreringsnumret ${vatNumber} har fel format (t.ex. SE556677889901 eller DE123456789).`));
  if (!/^[A-Z]{2}$/.test(country)) redirect(withParam(back, "error", "Välj land."));
  const data = {
    name,
    orgNumber,
    vatNumber,
    country,
    email: str(fd, "email"),
    address: str(fd, "address"),
    postalCode: str(fd, "postalCode"),
    city: str(fd, "city"),
    reference: str(fd, "reference"),
  };
  if (id) await db.customer.updateMany({ where: { id, companyId }, data });
  else await db.customer.create({ data: { ...data, companyId } });
  done("/customers", id ? "Kunden är uppdaterad." : `${name} är tillagd.`);
}

export async function deleteCustomer(fd: FormData) {
  const { companyId } = await requireWriter();
  const id = Number(str(fd, "id"));
  const used = await db.invoice.count({ where: { customerId: id, companyId } });
  if (used) redirect(withParam("/customers", "error", "Kunden har fakturor och kan inte tas bort."));
  await db.customer.deleteMany({ where: { id, companyId } });
  done("/customers", "Kunden är borttagen.");
}

export async function saveArticle(fd: FormData) {
  const { companyId } = await requireWriter();
  const id = Number(str(fd, "id"));
  const name = str(fd, "name");
  const price = parseKr(str(fd, "price"));
  if (!name || price == null) redirect(withParam("/articles", "error", "Ange namn och pris."));
  const data = { name, price, unit: str(fd, "unit") || "st", vatRate: Number(str(fd, "vatRate")) || 0, type: str(fd, "type") || "service" };
  if (id) await db.article.updateMany({ where: { id, companyId }, data });
  else await db.article.create({ data: { ...data, companyId } });
  done("/articles", id ? "Artikeln är uppdaterad." : `${name} är tillagd.`);
}

export async function deleteArticle(fd: FormData) {
  const { companyId } = await requireWriter();
  await db.article.deleteMany({ where: { id: Number(str(fd, "id")), companyId } });
  done("/articles", "Artikeln är borttagen.");
}

export async function saveCompany(fd: FormData) {
  const { companyId } = await requireWriter();
  const name = str(fd, "name");
  const orgNumber = str(fd, "orgNumber");
  const fail = (msg: string): never => redirect(withParam("/settings", "error", msg));
  if (!name || !validOrgNumber(orgNumber)) fail("Ange företagsnamn och ett giltigt organisationsnummer.");
  // Formatkontroll – säger inte att numret faktiskt är registrerat hos Skatteverket.
  const vatNumber = formatVatNumber(str(fd, "vatNumber"));
  if (vatNumber && !validSwedishVatNumber(vatNumber)) fail("Momsregistreringsnumret ska ha formatet SE + 10 siffror + 01, t.ex. SE556677889901.");
  if (vatNumber && !vatMatchesOrg(vatNumber, orgNumber)) fail("Momsregistreringsnumret ska innehålla samma siffror som organisationsnumret.");
  const rateRaw = str(fd, "lateInterestRate").replace(",", ".").replace("%", "");
  const lateInterestRate = rateRaw ? Number(rateRaw) : null;
  if (lateInterestRate !== null && (!Number.isFinite(lateInterestRate) || lateInterestRate < 0 || lateInterestRate > 100)) fail("Dröjsmålsräntan ska anges i procent, t.ex. 12.");
  const feeRaw = parseKr(str(fd, "reminderFee"));
  const reminderFee = feeRaw ?? 0;
  if (reminderFee < 0 || reminderFee > MAX_REMINDER_FEE) fail("Påminnelseavgiften får vara högst 60 kr.");
  await db.company.update({
    where: { id: companyId },
    data: {
      name,
      tradeName: str(fd, "tradeName"),
      orgNumber,
      vatNumber,
      seat: str(fd, "seat"),
      fSkatt: fd.get("fSkatt") === "on",
      address: str(fd, "address"),
      postalCode: str(fd, "postalCode"),
      city: str(fd, "city"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      website: str(fd, "website"),
      bankgiro: str(fd, "bankgiro"),
      invoiceDays: Math.min(365, Math.max(0, Number(str(fd, "invoiceDays")) || 0)),
      lateInterestRate,
      reminderFee,
    },
  });
  done("/settings", "Företagsuppgifterna är sparade.");
}

export async function saveAccount(fd: FormData) {
  const { companyId } = await requireWriter();
  const number = Number(str(fd, "number"));
  const name = str(fd, "name");
  if (!(number >= 1000 && number <= 8999) || !name) redirect(withParam("/settings/accounts", "error", "Ange ett kontonummer 1000–8999 och ett namn."));
  await db.account.upsert({
    where: { companyId_number: { companyId, number } },
    create: { companyId, number, name, vatCode: str(fd, "vatCode") },
    update: { name, vatCode: str(fd, "vatCode") },
  });
  done("/settings/accounts", `Konto ${number} är sparat.`);
}

export async function toggleAccount(fd: FormData) {
  const { companyId } = await requireWriter();
  const number = Number(str(fd, "number"));
  const where = { companyId_number: { companyId, number } };
  const a = await db.account.findUnique({ where });
  if (a) await db.account.update({ where, data: { active: !a.active } });
  done("/settings/accounts", `Konto ${number} är ${a?.active ? "inaktiverat" : "aktiverat"}.`);
}

export async function saveTemplate(fd: FormData) {
  const { companyId } = await requireWriter();
  const name = str(fd, "name");
  const costAccount = Number(str(fd, "costAccount"));
  if (!name || !costAccount) redirect(withParam("/settings/templates", "error", "Ange namn och konto."));
  const exists = await db.account.findUnique({ where: { companyId_number: { companyId, number: costAccount } } });
  if (!exists) redirect(withParam("/settings/templates", "error", `Kontot ${costAccount} finns inte.`));
  const direction = ["purchase", "sale", "reverse"].includes(str(fd, "direction")) ? str(fd, "direction") : "purchase";
  await db.template.create({
    data: {
      companyId,
      name,
      category: str(fd, "category") || "Övrigt",
      costAccount,
      vatRate: Number(str(fd, "vatRate")) || 0,
      direction,
      keywords: str(fd, "keywords"),
    },
  });
  done("/settings/templates", `Mallen ${name} är skapad.`);
}

export async function deleteTemplate(fd: FormData) {
  const { companyId } = await requireWriter();
  await db.template.deleteMany({ where: { id: Number(str(fd, "id")), companyId } });
  done("/settings/templates", "Mallen är borttagen.");
}

/** Raderar det aktiva företaget permanent. Bara ägare, och företagets namn måste skrivas in exakt. */
export async function deleteCompanyAction(fd: FormData) {
  const { companyId, company, user } = await requireOwner("Bara företagets ägare kan radera företaget.");
  // Företaget på sidan måste vara det aktiva, om man hunnit byta företag i en annan flik.
  if (Number(str(fd, "companyId")) !== companyId || str(fd, "confirmName") !== company.name.trim()) {
    redirect(withParam("/settings", "error", "Namnet stämmer inte. Inget har raderats."));
  }
  await deleteCompany(companyId);
  revalidatePath("/", "layout");
  const remaining = await db.membership.count({ where: { userId: user.id } });
  redirect(remaining ? withParam("/", "ok", `${company.name} är raderat.`) : "/companies/new");
}
