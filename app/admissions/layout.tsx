import { RoleShell } from "@/components/layout/role-shell";

export default function AdmissionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell group="admissions" groupLabel="Admissions">
      {children}
    </RoleShell>
  );
}
