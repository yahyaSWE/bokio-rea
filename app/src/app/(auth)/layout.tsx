export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary font-mono text-[13px] font-semibold text-primary-ink">H</span>
        <span className="text-[16px] font-semibold tracking-[-0.02em]">Huvudbok</span>
      </div>
      <div className="card w-full max-w-[420px] p-7 sm:p-8">{children}</div>
      <p className="mt-8 max-w-sm text-center text-[13px] text-muted">Bokföring, fakturering och moms för småföretag.</p>
    </div>
  );
}
