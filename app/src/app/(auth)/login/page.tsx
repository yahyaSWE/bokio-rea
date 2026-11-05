import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Flash, readParams, type SP } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { IDLE_MINUTES } from "@/lib/session-config";
import { login } from "../actions";

export default async function Login({ searchParams }: { searchParams: SP }) {
  if (await getSession()) redirect("/");
  const { get, error, notice } = await readParams(searchParams);
  return (
    <>
      <h1 className="mb-1 text-[22px] font-semibold tracking-[-0.02em]">Logga in</h1>
      <p className="mb-6 text-[14px] text-muted">
        Inget konto? <Link href="/register" className="font-medium text-ink underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-current">Registrera ditt företag</Link>
      </p>
      <Flash error={error} notice={get("expired") ? `Du loggades ut efter ${IDLE_MINUTES} minuter utan aktivitet. Logga in igen.` : notice} />
      <form action={login} className="space-y-4">
        <input type="hidden" name="next" value={get("next") ?? "/"} />
        <div>
          <label className="label" htmlFor="email">E-post</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Lösenord</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        <ConfirmButton className="btn-primary w-full">Logga in</ConfirmButton>
      </form>
    </>
  );
}
