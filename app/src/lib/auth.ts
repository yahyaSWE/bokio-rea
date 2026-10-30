import "server-only";
import { randomBytes } from "node:crypto";
import { hashToken } from "./token";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { IDLE_MINUTES, type Role } from "./session-config";

export { hashPassword, verifyPassword };

export const SESSION_COOKIE = "hb_session";
const SESSION_DAYS = 30;


export async function startSession(userId: number, activeCompanyId: number | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.session.create({ data: { id: hashToken(token), userId, activeCompanyId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Aktuell session (cachas per request). */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Sessionen, användaren och dess företag hämtas i en enda fråga (färre rundresor till databasen).
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { memberships: { include: { company: true }, orderBy: { companyId: "asc" } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  // Automatisk utloggning efter en tids inaktivitet på enheten.
  const idle = Date.now() - session.lastSeenAt.getTime();
  if (idle > IDLE_MINUTES * 60_000) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  // Senast aktiv uppdateras högst en gång i minuten, så att varje sidvisning inte blir en skrivning.
  if (idle > 60_000) await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return session;
});

export async function requireUser() {
  const s = await getSession();
  if (!s) redirect((await cookies()).has(SESSION_COOKIE) ? "/login?expired=1" : "/login");
  return s;
}

/** Inloggad användare + det aktiva företaget som användaren är medlem i. */
export const requireCompany = cache(async () => {
  const s = await requireUser();
  const memberships = s.user.memberships;
  if (memberships.length === 0) redirect("/companies/new");
  const active = memberships.find((m) => m.companyId === s.activeCompanyId) ?? memberships[0];
  if (active.companyId !== s.activeCompanyId) {
    await db.session.update({ where: { id: s.id }, data: { activeCompanyId: active.companyId } });
  }
  return {
    user: s.user,
    session: s,
    companyId: active.companyId,
    company: active.company,
    role: active.role as Role,
    companies: memberships.map((m) => m.company),
  };
});

export async function setActiveCompany(sessionId: string, userId: number, companyId: number) {
  const m = await db.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
  if (!m) return false;
  await db.session.update({ where: { id: sessionId }, data: { activeCompanyId: companyId } });
  return true;
}

export const READ_ONLY_MESSAGE = "Du har läsbehörighet i det här företaget och kan inte ändra något.";

/** Tillbaka till sidan man kom från, med ett felmeddelande. */
async function back(message: string): Promise<never> {
  let path = "/";
  try {
    const u = new URL((await headers()).get("referer") ?? "");
    u.searchParams.delete("error");
    u.searchParams.delete("ok");
    path = u.pathname + u.search;
  } catch {}
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

/** För alla ändringar (serveråtgärder): användare med läsbehörighet stoppas. */
export async function requireWriter() {
  const c = await requireCompany();
  if (c.role === "read") await back(READ_ONLY_MESSAGE);
  return c;
}

/** Bara ägare får hantera användare och behörigheter. */
export async function requireOwner(message = "Bara företagets ägare kan hantera användare.") {
  const c = await requireCompany();
  if (c.role !== "owner") await back(message);
  return c;
}

/** För API-routes: aktivt företag eller null (ingen redirect). */
export async function apiCompany() {
  const s = await getSession();
  if (!s?.activeCompanyId) return null;
  const m = await db.membership.findUnique({ where: { userId_companyId: { userId: s.userId, companyId: s.activeCompanyId } } });
  return m ? { userId: s.userId, companyId: m.companyId, role: m.role as Role } : null;
}
