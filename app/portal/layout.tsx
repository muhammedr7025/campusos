import { RoleShell } from "@/components/layout/role-shell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell group="portal" groupLabel="Student & Parent Portal">
      {children}
    </RoleShell>
  );
}
