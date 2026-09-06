"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function DuesFilterBar({ courses }: { courses: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Status lives in the pill row above; this bar only owns the course filter.
  const hasFilters = searchParams.get("course") != null;

  function clearCourse() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("course");
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={searchParams.get("course") ?? "all"} onValueChange={(v) => setParam("course", v)}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Course" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All courses</SelectItem>
          {courses.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearCourse}>
          <X /> Clear course
        </Button>
      )}
    </div>
  );
}
