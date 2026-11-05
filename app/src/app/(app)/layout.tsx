import { Sidebar } from "@/components/Sidebar";
import { requireCompany } from "@/lib/auth";
import { IdleLogout } from "@/components/IdleLogout";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { company, companies, user, role } = await requireCompany();
  return (
    <div className="md:flex md:min-h-screen">
      <Sidebar
        company={{ id: company.id, name: company.name }}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        userName={user.name}
        readOnly={role === "read"}
      />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 md:px-10 md:pt-10">
        <div className="mx-auto max-w-[1180px]">
          {role === "read" && (
            <p className="no-print mb-6 rounded-lg bg-brand-soft px-4 py-3 text-[14px] text-brand">
              <strong>Läsbehörighet.</strong> Du kan se bokföring, rapporter och underlag i {company.name}, men inte ändra något.
            </p>
          )}
          {children}
        </div>
        <IdleLogout />
      </main>
    </div>
  );
}
