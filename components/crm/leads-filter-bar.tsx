"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const SOURCES = ["WALK_IN", "PHONE", "WEB", "REFERRAL", "OTHER"];

export function LeadsFilterBar({
  counselors,
  courses,
}: {
  counselors: { id: string; name: string }[];
  courses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters = ["counselor", "source", "course", "from", "to"].some((k) => searchParams.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={searchParams.get("counselor") ?? "all"} onValueChange={(v) => setParam("counselor", v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Counselor" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All counselors</SelectItem>
          {counselors.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("source") ?? "all"} onValueChange={(v) => setParam("source", v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Source" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          {SOURCES.map((s) => (
            <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("course") ?? "all"} onValueChange={(v) => setParam("course", v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Course" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All courses</SelectItem>
          {courses.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        className="w-[140px]"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => setParam("from", e.target.value)}
      />
      <Input
        type="date"
        className="w-[140px]"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => setParam("to", e.target.value)}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X /> Clear
        </Button>
      )}
    </div>
  );
}
