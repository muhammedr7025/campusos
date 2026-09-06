"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, Search, LogOut, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell, type NotificationItem } from "@/components/layout/notification-bell";
import { CommandPalette } from "@/components/layout/command-palette";
import { NAV_ITEMS_BY_GROUP, type NavGroup } from "@/components/layout/nav-items";
import { signOut } from "next-auth/react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <div className="px-2.5 py-1 text-[10.5px] font-semibold tracking-[.14em] text-white/35 uppercase">
            {group.label}
          </div>
          {group.items.map((item) => {
            // Nav hrefs with a query string (e.g. two entries pointing at the
            // same route with different `?view=`) need an exact query match;
            // plain hrefs ignore the current query so page-owned filters
            // (?role=, ?date=, ...) don't break their own sidebar highlight.
            const [itemPath, itemQuery] = item.href.includes("?") ? item.href.split("?") : [item.href, null];
            const active =
              itemQuery !== null
                ? pathname === itemPath && searchParams.toString() === itemQuery
                : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-primary text-white" : "text-white/70 hover:bg-white/[.07] hover:text-white",
                )}
              >
                <span
                  className={cn("size-1.25 shrink-0 rounded-full", active ? "bg-[#C9821A]" : "bg-white/25")}
                  aria-hidden
                />
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  group,
  groupLabel,
  tenantName,
  tenantLogoUrl,
  userName,
  userEmail,
  roleLabel,
  notifications = [],
  enableCommandPalette = false,
  children,
}: {
  group: keyof typeof NAV_ITEMS_BY_GROUP;
  groupLabel: string;
  tenantName: string;
  tenantLogoUrl?: string | null;
  userName: string;
  userEmail: string;
  roleLabel: string;
  notifications?: NotificationItem[];
  enableCommandPalette?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navGroups: NavGroup[] = NAV_ITEMS_BY_GROUP[group] as unknown as NavGroup[];
  const flatNavItems: NavItem[] = navGroups.flatMap((g) => g.items);
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const brand = (
    <div className="flex items-center gap-2.5 px-1.5 py-1">
      {tenantLogoUrl ? (
        <Image src={tenantLogoUrl} alt={tenantName} width={30} height={30} className="rounded-lg" />
      ) : (
        <div className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-[#C9821A] text-sm font-bold text-[#10151A]">
          {tenantName.charAt(0)}
        </div>
      )}
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-semibold tracking-[.06em] text-white uppercase">{tenantName}</div>
        <div className="truncate text-[11px] text-white/45">{groupLabel}</div>
      </div>
    </div>
  );

  const sidebarFooter = (
    <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-3">
      <div className="flex items-center gap-2.5 px-1">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#15584A] text-[12.5px] font-semibold text-white">
          {initials}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold text-white">{userName}</div>
          <div className="truncate text-[11px] text-white/45">{roleLabel}</div>
        </div>
      </div>
      <Button
        variant="ghost"
        className="h-9 justify-start gap-2 rounded-lg border border-white/[.14] text-[12.5px] font-medium text-white/70 hover:bg-white/[.07] hover:text-white"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        <LogOut className="size-3.5" /> Switch role / sign out
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-svh w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar sticky top-0 hidden h-svh w-64 shrink-0 flex-col gap-5 overflow-y-auto p-3.5 md:flex">
        {brand}
        <NavLinks groups={navGroups} />
        {sidebarFooter}
      </aside>

      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <header className="bg-muted/90 sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-3 backdrop-blur sm:px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar w-72 border-0 p-3.5 [&_[data-slot=sheet-close]]:text-white/70">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-full flex-col gap-5">
                {brand}
                <div className="flex-1 overflow-y-auto">
                  <NavLinks groups={navGroups} onNavigate={() => setMobileOpen(false)} />
                </div>
                {sidebarFooter}
              </div>
            </SheetContent>
          </Sheet>

          {enableCommandPalette && (
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground hidden gap-2 bg-transparent sm:inline-flex"
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            >
              <Search className="size-3.5" /> Quick jump
              <kbd className="bg-background rounded px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </Button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-[12.5px] font-semibold text-[#15584A]">
            <span className="size-1.75 rounded-full bg-[#15584A]" />
            {roleLabel}
          </div>
          <NotificationBell notifications={notifications} />
          <ThemeToggle />
          <UserMenu name={userName} email={userEmail} roleLabel={roleLabel} />
        </header>

        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>
      {enableCommandPalette && <CommandPalette navItems={flatNavItems} />}
    </div>
  );
}
