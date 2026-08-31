import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Layers,
  Users,
  Palette,
  BarChart3,
  Wallet,
  Receipt,
  AlertCircle,
  Contact,
  ClipboardCheck,
  UserPlus,
  CalendarDays,
  ClipboardList,
  FileText,
} from "lucide-react";
import type { NavItem } from "@/components/layout/app-shell";
import { ROLE_VALUES, type RoleValue } from "@/lib/constants/roles";

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/batches", label: "Batches", icon: Layers },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/divisions", label: "Divisions", icon: GraduationCap },
  { href: "/admin/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings/branding", label: "Branding", icon: Palette },
];

export const FINANCE_NAV: NavItem[] = [
  { href: "/finance/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/finance/fee-structures", label: "Fee structures", icon: Wallet },
  { href: "/finance/payments", label: "Payments", icon: Receipt },
  { href: "/finance/dues", label: "Dues", icon: AlertCircle },
];

export const CRM_NAV: NavItem[] = [
  { href: "/crm/leads", label: "Leads", icon: Contact },
];

export const ADMISSIONS_NAV: NavItem[] = [
  { href: "/admissions/pending-kyc", label: "Pending KYC", icon: ClipboardCheck },
  { href: "/admissions/students", label: "Students", icon: UserPlus },
];

export const TEACHER_NAV: NavItem[] = [
  { href: "/teacher/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/teacher/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/teacher/assignments", label: "Assignments", icon: FileText },
];

export const PORTAL_NAV: NavItem[] = [
  { href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/portal/assignments", label: "Assignments", icon: FileText },
  { href: "/portal/fees", label: "Fees", icon: Wallet },
];

export const NAV_ITEMS_BY_GROUP = {
  admin: ADMIN_NAV,
  finance: FINANCE_NAV,
  crm: CRM_NAV,
  admissions: ADMISSIONS_NAV,
  teacher: TEACHER_NAV,
  portal: PORTAL_NAV,
} as const;

export const ROLE_LABEL: Record<RoleValue, string> = {
  [ROLE_VALUES.SUPER_ADMIN]: "Super Admin",
  [ROLE_VALUES.FINANCE]: "Finance",
  [ROLE_VALUES.COUNSELOR]: "Counselor",
  [ROLE_VALUES.ADMISSION_OFFICER]: "Admission Officer",
  [ROLE_VALUES.TEACHER]: "Teacher",
  [ROLE_VALUES.STUDENT]: "Student",
  [ROLE_VALUES.PARENT]: "Parent",
};
