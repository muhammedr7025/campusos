"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Design-system status filter row — a horizontal pill list backed by a URL search param. */
export function FilterPills({
  options,
  active,
  paramKey,
}: {
  options: string[];
  active: string;
  paramKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pick(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "All") params.delete(paramKey);
    else params.set(paramKey, value);
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const isActive = option === active;
        return (
          <button
            key={option}
            type="button"
            onClick={() => pick(option)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:border-foreground/40",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
