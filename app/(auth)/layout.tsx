import { getCurrentTenant } from "@/lib/tenant";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();

  return (
    <div className="grid min-h-svh grid-cols-1 bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#10151A] p-10 text-[#F5F3EE] lg:flex xl:p-16">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 85% 10%, rgba(21,88,74,.55), transparent 60%), radial-gradient(80% 60% at 10% 100%, rgba(201,130,26,.22), transparent 65%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#C9821A] text-sm font-bold text-[#10151A]">C</div>
          <div className="text-sm font-semibold tracking-[.14em] text-[#F5F3EE]/85 uppercase">CampusOS</div>
        </div>
        <div className="relative max-w-lg py-10">
          {tenant && (
            <div className="mb-4 text-xs font-semibold tracking-[.18em] text-[#C9821A] uppercase">{tenant.name}</div>
          )}
          <h1 className="font-heading text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05] font-normal tracking-tight">
            One student record. <em className="text-[#8FBFAE] not-italic">Every</em> role sees it live.
          </h1>
          <p className="mt-5 max-w-[42ch] text-[15px] leading-relaxed text-[#F5F3EE]/65 text-pretty">
            Create a course and Finance can price it. Log a payment and the parent sees it instantly. Mark
            attendance and the student&apos;s percentage moves the same second.
          </p>
        </div>
        <div className="relative flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-[#F5F3EE]/50">
          <span>Full audit trail</span>
          <span>Delete guards on every dependency</span>
          <span>Role-scoped by design</span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">{children}</div>
    </div>
  );
}
