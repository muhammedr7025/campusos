import { RoleShell } from "@/components/layout/role-shell";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell>{children}</RoleShell>;
}
