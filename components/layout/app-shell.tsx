"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell, type NotificationItem } from "@/components/layout/notification-bell";
import { CommandPalette } from "@/components/layout/command-palette";
import { NAV_ITEMS_BY_GROUP } from "@/components/layout/nav-items";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
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
  const navItems: NavItem[] = [...NAV_ITEMS_BY_GROUP[group]];

  const brand = (
    <div className="flex items-center gap-2 px-1">
      {tenantLogoUrl ? (
        <Image src={tenantLogoUrl} alt={tenantName} width={28} height={28} className="rounded" />
      ) : (
        <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded text-sm font-semibold">
          {tenantName.charAt(0)}
        </div>
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{tenantName}</span>
        <span className="text-muted-foreground text-xs">{groupLabel}</span>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-svh w-full">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar text-sidebar-foreground hidden w-64 shrink-0 flex-col gap-6 border-r p-4 md:flex">
        {brand}
        <NavLinks items={navItems} />
      </aside>

      <div className="flex min-h-svh flex-1 flex-col">
        <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col gap-6">
                {brand}
                <NavLinks items={navItems} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          {enableCommandPalette && (
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground hidden gap-2 sm:inline-flex"
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            >
              <Search className="size-3.5" /> Quick jump
              <kbd className="bg-muted rounded px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </Button>
          )}
          <div className="flex-1" />
          <NotificationBell notifications={notifications} />
          <ThemeToggle />
          <UserMenu name={userName} email={userEmail} roleLabel={roleLabel} />
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      {enableCommandPalette && <CommandPalette navItems={navItems} />}
    </div>
  );
}
