import { RoleShell } from "@/components/layout/role-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell>{children}</RoleShell>;
}
