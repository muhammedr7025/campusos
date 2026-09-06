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
  CalendarClock,
  FileCheck,
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
  { label: "Overview", items: [{ href: "/finance/dashboard", label: "Collections", icon: LayoutDashboard }] },
  {
    label: "Money",
    items: [
      { href: "/finance/fee-structures", label: "Fee structures", icon: Wallet },
      { href: "/finance/dues", label: "Student dues", icon: AlertCircle },
      { href: "/finance/payments", label: "Payment ledger", icon: Receipt },
    ],
  },
  {
    label: "Actions",
    items: [
      { href: "/finance/reminders", label: "Reminder queue", icon: Megaphone },
      { href: "/finance/discounts", label: "Discounts & approvals", icon: ScrollText },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/finance/reports", label: "Collection report", icon: BarChart3 },
      { href: "/admin/audit", label: "Audit log", icon: History },
      MY_PROFILE,
    ],
  },
];

export const CRM_NAV: NavGroup[] = [
  {
    label: "Pipeline",
    items: [
      { href: "/crm/leads", label: "Pipeline board", icon: Contact },
      { href: "/crm/leads?view=table", label: "All leads", icon: Table2 },
      { href: "/crm/followups", label: "Follow-ups due", icon: CalendarClock },
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
  {
    label: "Me",
    items: [{ href: "/crm/activity", label: "My activity", icon: History }, MY_PROFILE],
  },
];

export const ADMISSIONS_NAV: NavGroup[] = [
  {
    label: "Admissions",
    items: [
      { href: "/admissions/queue", label: "Conversion queue", icon: UserPlus },
      { href: "/admissions/kyc", label: "KYC tracker", icon: ClipboardCheck },
      { href: "/admissions/students", label: "Admitted students", icon: GraduationCap },
      { href: "/admissions/capacity", label: "Division capacity", icon: Layers },
    ],
  },
  {
    label: "Comms",
    items: [
      { href: "/admissions/invites", label: "Parent invites", icon: Megaphone },
      { href: "/admissions/notices", label: "Notices", icon: FileText },
    ],
  },
  {
    label: "Records",
    items: [{ href: "/admin/audit", label: "Audit log", icon: History }, MY_PROFILE],
  },
];

export const TEACHER_NAV: NavGroup[] = [
  {
    label: "Teaching",
    items: [
      { href: "/teacher/attendance", label: "Mark attendance", icon: ClipboardList },
      { href: "/teacher/timetable", label: "My timetable", icon: CalendarDays },
      { href: "/teacher/classes", label: "My classes", icon: Layers },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/teacher/assignments", label: "Assignments", icon: FileText },
      { href: "/teacher/grading", label: "Grading", icon: FileCheck },
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

/**
 * Student and parent share the /portal routes but not the reading of them:
 * a student is looking at their own week, a parent at their children. The
 * pages adapt by role; the nav says so plainly.
 */
export const STUDENT_NAV: NavGroup[] = [
  {
    label: "My studies",
    items: [
      { href: "/portal/dashboard", label: "Home", icon: LayoutDashboard },
      { href: "/portal/timetable", label: "Timetable", icon: CalendarDays },
      { href: "/portal/assignments", label: "Assignments", icon: FileText },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/portal/notes", label: "Subject notes", icon: BookOpen },
      { href: "/portal/exams", label: "Exam schedule", icon: CalendarClock },
      { href: "/portal/exams?view=results", label: "My marks", icon: ScrollText },
      { href: "/portal/attendance", label: "My attendance", icon: ClipboardList },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/portal/fees", label: "Fees & receipts", icon: Wallet },
      { href: "/portal/announcements", label: "Notices", icon: Megaphone },
      MY_PROFILE,
    ],
  },
];

export const PARENT_NAV: NavGroup[] = [
  {
    label: "Family",
    items: [
      { href: "/portal/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/portal/attendance", label: "Attendance", icon: ClipboardList },
      { href: "/portal/assignments", label: "Assignments", icon: FileText },
      { href: "/portal/exams", label: "Results", icon: ScrollText },
    ],
  },
  {
    label: "Money",
    items: [{ href: "/portal/fees", label: "Fee plan & dues", icon: Wallet }],
  },
  {
    label: "School",
    items: [
      { href: "/portal/contacts", label: "Teacher contacts", icon: Contact },
      { href: "/portal/notes", label: "Subject notes", icon: BookOpen },
      { href: "/portal/announcements", label: "Notices", icon: Megaphone },
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
  student: STUDENT_NAV,
  parent: PARENT_NAV,
} as const;

/**
 * Which sidebar a role always sees, regardless of which URL segment its
 * current page happens to live under. Every role's own pages already permit
 * cross-namespace links where the design calls for them (e.g. Finance's own
 * nav links out to /admin/audit) — so the sidebar has to follow the signed-in
 * role, not the current route, or the shell would swap to that route's
 * section nav out from under the visitor.
 */
export const ROLE_DEFAULT_GROUP: Record<RoleValue, keyof typeof NAV_ITEMS_BY_GROUP> = {
  [ROLE_VALUES.SUPER_ADMIN]: "admin",
  [ROLE_VALUES.FINANCE]: "finance",
  [ROLE_VALUES.COUNSELOR]: "crm",
  [ROLE_VALUES.ADMISSION_OFFICER]: "admissions",
  [ROLE_VALUES.TEACHER]: "teacher",
  [ROLE_VALUES.STUDENT]: "student",
  [ROLE_VALUES.PARENT]: "parent",
};

export const GROUP_LABEL: Record<keyof typeof NAV_ITEMS_BY_GROUP, string> = {
  admin: "Admin",
  finance: "Finance",
  crm: "CRM",
  admissions: "Admissions",
  teacher: "Teacher",
  student: "Student portal",
  parent: "Parent portal",
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
