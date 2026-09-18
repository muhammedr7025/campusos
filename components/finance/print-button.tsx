"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Prints the page; with `auto`, does so as soon as it has rendered. */
export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(id);
  }, [auto]);

  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer /> Print receipt
    </Button>
  );
}
