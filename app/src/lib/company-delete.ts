import "server-only";
import { db } from "./db";
import { deleteStored } from "./storage";

/** Vad som försvinner om företaget raderas (visas innan man bekräftar). */
export async function companyContents(companyId: number) {
  const [verifications, invoices, customers, uploads, users] = await Promise.all([
    db.verification.count({ where: { companyId } }),
    db.invoice.count({ where: { companyId, number: { not: null } } }),
    db.customer.count({ where: { companyId } }),
    db.upload.count({ where: { companyId } }),
    db.membership.count({ where: { companyId } }),
  ]);
  return { verifications, invoices, customers, uploads, users };
}

/**
 * Raderar ett företag permanent. Databasens kaskader tar all bokföring, alla fakturor, kunder, medlemskap och
 * kopplingar i en enda atomisk radering; filerna tas bort efteråt, så att ett fel inte lämnar ett halvraderat företag.
 */
export async function deleteCompany(companyId: number) {
  const [uploads, company] = await Promise.all([
    db.upload.findMany({ where: { companyId }, select: { storedName: true, blobUrl: true } }),
    db.company.findUniqueOrThrow({ where: { id: companyId }, select: { logoStoredName: true, logoBlobUrl: true } }),
  ]);
  await db.$transaction([
    // Engångskoder för kopplingar har ingen främmande nyckel till företaget.
    db.oAuthCode.deleteMany({ where: { companyId } }),
    db.company.delete({ where: { id: companyId } }),
  ]);
  const files = [...uploads, ...(company.logoStoredName ? [{ storedName: company.logoStoredName, blobUrl: company.logoBlobUrl }] : [])];
  await Promise.allSettled(files.map((f) => deleteStored(f)));
}
