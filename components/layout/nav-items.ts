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
  Megaphone,
  ScrollText,
  History,
  UserRound,
  Table2,
} from "lucide-react";
import type { NavItem } from "@/components/layout/app-shell";
import { ROLE_VALUES, type RoleValue } from "@/lib/constants/roles";

export type NavGroup = { label: string; items: NavItem[] };

const MY_PROFILE: NavItem = { href: "/profile", label: "My profile", icon: UserRound };

export const ADMIN_NAV: NavGroup[] = [
  { label: "Overview", items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Academics",
    items: [
      { href: "/admin/batches", label: "Batches", icon: Layers },
      { href: "/admin/courses", label: "Courses", icon: BookOpen },
      { href: "/admin/divisions", label: "Divisions", icon: GraduationCap },
      { href: "/admin/timetable", label: "Timetable", icon: CalendarDays },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admissions/students", label: "Students", icon: UserPlus },
      { href: "/admin/users", label: "Users & roles", icon: Users },
      { href: "/teacher/notes", label: "Subject notes", icon: BookOpen },
      { href: "/teacher/exams", label: "Exam schedule", icon: ScrollText },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/finance/dashboard", label: "Collections", icon: LayoutDashboard },
      { href: "/finance/fee-structures", label: "Fee structures", icon: Wallet },
      { href: "/finance/payments", label: "Payment ledger", icon: Receipt },
      { href: "/finance/reports", label: "Collection report", icon: BarChart3 },
      { href: "/finance/discounts", label: "Discount approvals", icon: ScrollText },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/crm/leads", label: "Pipeline board", icon: Contact },
      { href: "/crm/leads?view=table", label: "All leads", icon: Table2 },
      { href: "/crm/import", label: "Bulk import", icon: UserPlus },
      { href: "/crm/sources", label: "Source performance", icon: BarChart3 },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/audit", label: "Audit log", icon: History },
      { href: "/admin/reports", label: "Institute reports", icon: BarChart3 },
      { href: "/admin/settings/branding", label: "Branding", icon: Palette },
      MY_PROFILE,
    ],
  },
];

export const FINANCE_NAV: NavGroup[] = [
  { label: "Overview", items: [{ href: "/finance/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Money",
    items: [
      { href: "/finance/fee-structures", label: "Fee structures", icon: Wallet },
      { href: "/finance/payments", label: "Payment ledger", icon: Receipt },
      { href: "/finance/dues", label: "Dues", icon: AlertCircle },
    ],
  },
  {
    label: "Actions",
    items: [
      { href: "/finance/reminders", label: "Reminder queue", icon: Megaphone },
      { href: "/finance/discounts", label: "Discounts & approvals", icon: ScrollText },
      { href: "/finance/reports", label: "Collection report", icon: BarChart3 },
    ],
  },
  { label: "Me", items: [MY_PROFILE] },
];

export const CRM_NAV: NavGroup[] = [
  {
    label: "Pipeline",
    items: [
      { href: "/crm/leads", label: "Leads", icon: Contact },
      { href: "/crm/import", label: "Bulk import", icon: UserPlus },
    ],
  },
  {
    label: "Analysis",
    items: [
      { href: "/crm/sources", label: "Source performance", icon: BarChart3 },
      { href: "/crm/lost", label: "Lost reasons", icon: History },
    ],
  },
  { label: "Me", items: [MY_PROFILE] },
];

export const ADMISSIONS_NAV: NavGroup[] = [
  {
    label: "Admissions",
    items: [
      { href: "/admissions/pending-kyc", label: "Pending KYC", icon: ClipboardCheck },
      { href: "/admissions/students", label: "Students", icon: UserPlus },
      { href: "/admissions/invites", label: "Parent invites", icon: Megaphone },
    ],
  },
  { label: "Me", items: [MY_PROFILE] },
];

export const TEACHER_NAV: NavGroup[] = [
  {
    label: "Teaching",
    items: [
      { href: "/teacher/timetable", label: "Timetable", icon: CalendarDays },
      { href: "/teacher/attendance", label: "Attendance", icon: ClipboardList },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/teacher/assignments", label: "Assignments", icon: FileText },
      { href: "/teacher/exams", label: "Exams & marks", icon: ScrollText },
      { href: "/teacher/notes", label: "Subject notes", icon: BookOpen },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/teacher/students", label: "My students", icon: Users },
      { href: "/teacher/attendance-report", label: "Attendance report", icon: BarChart3 },
    ],
  },
  { label: "Me", items: [MY_PROFILE] },
];

export const PORTAL_NAV: NavGroup[] = [
  { label: "Overview", items: [{ href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Academics",
    items: [
      { href: "/portal/attendance", label: "Attendance", icon: ClipboardList },
      { href: "/portal/assignments", label: "Assignments", icon: FileText },
      { href: "/portal/exams", label: "Exams & results", icon: ScrollText },
      { href: "/portal/notes", label: "Subject notes", icon: BookOpen },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/portal/fees", label: "Fees", icon: Wallet },
      { href: "/portal/announcements", label: "Announcements", icon: Megaphone },
      MY_PROFILE,
    ],
  },
];

export const NAV_ITEMS_BY_GROUP = {
  admin: ADMIN_NAV,
  finance: FINANCE_NAV,
  crm: CRM_NAV,
  admissions: ADMISSIONS_NAV,
  teacher: TEACHER_NAV,
  portal: PORTAL_NAV,
} as const;

/** Which sidebar a role sees when it lands on a route with no fixed group (e.g. the shared /profile page). */
export const ROLE_DEFAULT_GROUP: Record<RoleValue, keyof typeof NAV_ITEMS_BY_GROUP> = {
  [ROLE_VALUES.SUPER_ADMIN]: "admin",
  [ROLE_VALUES.FINANCE]: "finance",
  [ROLE_VALUES.COUNSELOR]: "crm",
  [ROLE_VALUES.ADMISSION_OFFICER]: "admissions",
  [ROLE_VALUES.TEACHER]: "teacher",
  [ROLE_VALUES.STUDENT]: "portal",
  [ROLE_VALUES.PARENT]: "portal",
};

export const ROLE_LABEL: Record<RoleValue, string> = {
  [ROLE_VALUES.SUPER_ADMIN]: "Super Admin",
  [ROLE_VALUES.FINANCE]: "Finance",
  [ROLE_VALUES.COUNSELOR]: "Counselor",
  [ROLE_VALUES.ADMISSION_OFFICER]: "Admission Officer",
  [ROLE_VALUES.TEACHER]: "Teacher",
  [ROLE_VALUES.STUDENT]: "Student",
  [ROLE_VALUES.PARENT]: "Parent",
};
