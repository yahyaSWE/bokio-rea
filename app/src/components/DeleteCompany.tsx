"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteCompanyAction } from "@/app/(app)/registers/actions";

function Submit({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-danger" disabled={!ready || pending}>
      {pending ? "Raderar…" : "Radera företaget permanent"}
    </button>
  );
}

/** Radering kräver att företagets namn skrivs in exakt, så att fel företag inte kan raderas av misstag. */
export function DeleteCompany({ id, name }: { id: number; name: string }) {
  const [typed, setTyped] = useState("");
  return (
    <form action={deleteCompanyAction} className="space-y-3">
      <input type="hidden" name="companyId" value={id} />
      <div>
        <label className="label" htmlFor="confirmName">
          Skriv företagets namn för att bekräfta: <strong className="text-ink">{name}</strong>
        </label>
        <input id="confirmName" name="confirmName" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="input" />
      </div>
      <Submit ready={typed.trim() === name.trim()} />
    </form>
  );
}
