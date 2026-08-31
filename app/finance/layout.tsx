import { RoleShell } from "@/components/layout/role-shell";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell group="finance" groupLabel="Finance">
      {children}
    </RoleShell>
  );
}
