// Radering av företag: allt i företaget försvinner, och inget annat påverkas. Körs med `npm test` (kräver DATABASE_URL).
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { createCompany } from "../src/lib/company-setup";
import { creditInvoice, sendInvoice, registerInvoicePayment } from "../src/lib/accounting";
import { deleteCompany, companyContents } from "../src/lib/company-delete";

let available = true;
let userId = 0;
let A = 0;
let B = 0;
const stamp = Date.now();

const make = (name: string) =>
  db.$transaction((tx) =>
    createCompany(tx, userId, { name, orgNumber: "556677-8899", vatNumber: "SE556677889901", address: "Testgatan 1", postalCode: "111 22", city: "Stockholm", email: "test@huvudbok.test" }),
  );

/** Fyller ett företag med fakturor, kreditfaktura, verifikat, underlag, bankrad, mejl och koppling. */
async function fill(companyId: number) {
  await db.company.update({ where: { id: companyId }, data: { seat: "Stockholm", bankgiro: "123-4567" } });
  const customer = await db.customer.create({ data: { companyId, name: "Kund AB", address: "Vägen 1", postalCode: "222 33", city: "Lund" } });
  const draft = () =>
    db.invoice.create({
      data: { companyId, customerId: customer.id, date: new Date("2026-10-22T00:00:00Z"), dueDate: new Date("2026-11-21T00:00:00Z"), lines: { create: [{ description: "Tjänst", quantity: 1, unitPrice: 100000, vatRate: 25 }] } },
    });
  const a = await draft();
  await sendInvoice(companyId, a.id);
  await creditInvoice(companyId, a.id);
  const b = await draft();
  await sendInvoice(companyId, b.id);
  await registerInvoicePayment(companyId, b.id, new Date("2026-10-25T00:00:00Z"));
  const inbound = await db.inboundEmail.create({ data: { companyId, messageId: `m-${companyId}`, fromAddress: "a@b.se", status: "ok" } });
  await db.upload.create({ data: { companyId, fileName: "k.pdf", storedName: `companies/${companyId}/saknas.pdf`, mimeType: "application/pdf", source: "email", inboundEmailId: inbound.id } });
  await db.bankTransaction.create({ data: { companyId, date: new Date("2026-10-25T00:00:00Z"), amount: -100, text: "Bank", hash: `h-${companyId}` } });
  await db.article.create({ data: { companyId, name: "Artikel", price: 100 } });
  const client = await db.oAuthClient.create({ data: { id: `test-${companyId}-${stamp}`, name: "Test", redirectUris: ["https://x.test/cb"] } });
  const grant = await db.oAuthGrant.create({ data: { clientId: client.id, userId, companyId, scope: "read", resource: "https://x.test/api/mcp" } });
  await db.oAuthToken.create({ data: { tokenHash: `t-${companyId}-${stamp}`, grantId: grant.id, kind: "access", expiresAt: new Date(Date.now() + 3600_000) } });
  await db.oAuthCode.create({ data: { codeHash: `c-${companyId}-${stamp}`, clientId: client.id, userId, companyId, scope: "read", redirectUri: "https://x.test/cb", codeChallenge: "x", resource: "https://x.test/api/mcp", expiresAt: new Date(Date.now() + 60_000) } });
  await db.invitation.create({ data: { companyId, email: "r@x.se", role: "read", tokenHash: `i-${companyId}-${stamp}`, expiresAt: new Date(Date.now() + 86_400_000) } });
}

const counts = async (companyId: number) => ({
  verifications: await db.verification.count({ where: { companyId } }),
  lines: await db.verificationLine.count({ where: { companyId } }),
  invoices: await db.invoice.count({ where: { companyId } }),
  events: await db.invoiceEvent.count({ where: { companyId } }),
  customers: await db.customer.count({ where: { companyId } }),
  accounts: await db.account.count({ where: { companyId } }),
  years: await db.fiscalYear.count({ where: { companyId } }),
  uploads: await db.upload.count({ where: { companyId } }),
  inbound: await db.inboundEmail.count({ where: { companyId } }),
  bank: await db.bankTransaction.count({ where: { companyId } }),
  grants: await db.oAuthGrant.count({ where: { companyId } }),
  codes: await db.oAuthCode.count({ where: { companyId } }),
  invitations: await db.invitation.count({ where: { companyId } }),
  members: await db.membership.count({ where: { companyId } }),
});

before(async () => {
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    available = false;
    return;
  }
  userId = (await db.user.create({ data: { email: `radera-test-${stamp}@huvudbok.test`, name: "Raderatest", passwordHash: "x" } })).id;
  A = (await make(`Radera A ${stamp} AB`)).id;
  B = (await make(`Radera B ${stamp} AB`)).id;
  await fill(A);
  await fill(B);
});

after(async () => {
  if (!available) return;
  await db.company.deleteMany({ where: { id: { in: [A, B] } } });
  await db.oAuthClient.deleteMany({ where: { id: { startsWith: "test-" } } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});

test("radering tar bort allt i företaget men inte andra företag eller kontot", async (t) => {
  if (!available) return t.skip("ingen databas");
  const summary = await companyContents(A);
  assert.equal(summary.invoices, 3); // två fakturor och en kreditfaktura
  assert.ok(summary.verifications >= 3);
  const before = await counts(B);
  assert.ok(Object.entries(before).every(([, n]) => n > 0), "testet ska täcka alla typer av data");

  await deleteCompany(A);

  assert.equal(await db.company.findUnique({ where: { id: A } }), null);
  const left = await counts(A);
  assert.deepEqual(Object.entries(left).filter(([, n]) => n > 0), [], "inget får finnas kvar");
  assert.deepEqual(await counts(B), before, "det andra företaget är orört");
  assert.ok(await db.user.findUnique({ where: { id: userId } }), "kontot finns kvar");
  assert.equal(await db.membership.count({ where: { userId } }), 1);
});
