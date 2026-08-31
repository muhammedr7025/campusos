import { RoleShell } from "@/components/layout/role-shell";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell group="teacher" groupLabel="Teacher">
      {children}
    </RoleShell>
  );
}
