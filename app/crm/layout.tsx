import { RoleShell } from "@/components/layout/role-shell";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell>{children}</RoleShell>;
}
