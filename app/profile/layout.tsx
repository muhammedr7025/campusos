import { RoleShell } from "@/components/layout/role-shell";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell>{children}</RoleShell>;
}
