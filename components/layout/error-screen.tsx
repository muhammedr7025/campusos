import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The shared look for the pages nobody plans to see: a thrown error, a 404,
 * a session that stopped being valid. Always offers a way back — landing on
 * one of these used to mean a bare browser error page and a dead end.
 */
export function ErrorScreen({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground size-6" />
      </div>
      <div className="max-w-md space-y-1">
        <h1 className="font-heading text-xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {children}
        {action && (
          <Button asChild variant="outline">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
