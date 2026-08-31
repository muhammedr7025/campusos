"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchDirectory, type SearchResults } from "@/lib/actions/search";
import type { NavItem } from "@/components/layout/app-shell";

const EMPTY_RESULTS: SearchResults = { leads: [], students: [] };

export function CommandPalette({ navItems }: { navItems: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>(EMPTY_RESULTS);
  const router = useRouter();

  const results = query.trim().length < 2 ? EMPTY_RESULTS : searchResults;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timeout = setTimeout(() => {
      searchDirectory(query).then(setSearchResults);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Quick jump" description="Search leads, students, or jump to a page">
      <CommandInput placeholder="Search leads, students, or pages…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          {navItems.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <item.icon /> {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {results.leads.length > 0 && (
          <CommandGroup heading="Leads">
            {results.leads.map((lead) => (
              <CommandItem key={lead.id} onSelect={() => go(`/crm/leads/${lead.id}`)}>
                {lead.name} <span className="text-muted-foreground ml-2 text-xs">{lead.phone}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.students.length > 0 && (
          <CommandGroup heading="Students">
            {results.students.map((student) => (
              <CommandItem key={student.id} onSelect={() => go(`/admissions/students/${student.id}`)}>
                {student.name} <span className="text-muted-foreground ml-2 text-xs">{student.enrollmentNumber}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
