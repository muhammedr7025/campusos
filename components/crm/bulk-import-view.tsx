"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { bulkImportLeads } from "@/lib/actions/leads";
import type { LeadSource } from "@/generated/prisma/client";

const SAMPLE_CSV = [
  "name, phone, course, source",
  "Aditi Balan, +91 98111 20301, NEET Foundation, Instagram",
  "Rohan Pillai, +91 98111 20302, JEE Crash, Referral",
  "Fatima Nazar, +91 98111 20303, Spoken English, Walk-in",
  "Sidharth Menon, +91 98111 20304, NEET Foundation, Web form",
  "Ayesha Thomas, +91 98111 20305, JEE Crash, Instagram",
].join("\n");

const SOURCE_MAP: Record<string, LeadSource> = {
  "walk-in": "WALK_IN",
  walkin: "WALK_IN",
  instagram: "OTHER",
  referral: "REFERRAL",
  "web form": "WEB",
  webform: "WEB",
  "phone call": "PHONE",
  phonecall: "PHONE",
  phone: "PHONE",
};

function normalizeSource(raw: string): LeadSource {
  const key = raw.trim().toLowerCase();
  return SOURCE_MAP[key] ?? "OTHER";
}

type ParsedRow = { name: string; phone: string; courseName: string; source: LeadSource; valid: boolean };

export function BulkImportView({ courseNames }: { courseNames: string[] }) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const router = useRouter();

  const parsed = useMemo<ParsedRow[]>(() => {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^name\s*,/i.test(l))
      .map((line) => {
        const parts = line.split(",").map((v) => v.trim());
        const name = parts[0] || "";
        const phone = parts[1] || "";
        const courseName = parts[2] || "";
        const source = normalizeSource(parts[3] || "");
        const digits = phone.replace(/[^0-9]/g, "");
        return { name, phone, courseName, source, valid: !!name && digits.length >= 10 };
      });
  }, [text]);

  const courseSet = new Set(courseNames.map((c) => c.toLowerCase()));

  async function onImport() {
    const rows = parsed.filter((r) => r.valid).map((r) => ({ name: r.name, phone: r.phone, courseName: r.courseName || undefined, source: r.source }));
    if (rows.length === 0) {
      toast.error("Nothing valid to import — check names and phone numbers.");
      return;
    }
    setImporting(true);
    const result = await bulkImportLeads({ rows });
    setImporting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.data.imported} leads imported${result.data.skipped ? ` · ${result.data.skipped} duplicates/invalid skipped` : ""}.`);
    setText("");
    router.push("/crm/leads");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div>
              <p className="text-[15px] font-semibold">Paste your sheet</p>
              <p className="text-muted-foreground text-[12.5px]">
                One lead per line: <b>name, phone, course, source</b> — header row optional.
              </p>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Ananya Krishnan, +91 98470 11234, NEET Foundation, Walk-in"
              className="font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setText(SAMPLE_CSV)}>
                Load sample
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setText("")}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <p className="text-[15px] font-semibold">Import summary</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border p-3">
                <div className="font-heading text-2xl">{parsed.length}</div>
                <div className="text-muted-foreground text-[11px] uppercase">Rows read</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="font-heading text-2xl text-[#15584A]">{parsed.filter((r) => r.valid).length}</div>
                <div className="text-muted-foreground text-[11px] uppercase">Ready</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="font-heading text-2xl text-[#B3402F]">{parsed.filter((r) => !r.valid).length}</div>
                <div className="text-muted-foreground text-[11px] uppercase">Invalid</div>
              </div>
            </div>
            <p className="text-muted-foreground text-[12.5px] leading-relaxed">
              Duplicates are checked on the server against existing leads and enrolled students by phone number, so a
              re-import never creates a second record for the same person.
            </p>
            <Button onClick={onImport} disabled={importing || parsed.filter((r) => r.valid).length === 0}>
              {importing ? <Loader2 className="animate-spin" /> : <Upload />}
              Import {parsed.filter((r) => r.valid).length || ""} leads
            </Button>
          </CardContent>
        </Card>
      </div>

      {parsed.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <p className="text-[15px] font-semibold">Preview</p>
            <div className="flex flex-col gap-1.5">
              {parsed.slice(0, 12).map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-3 border-b py-1.5 text-sm last:border-0">
                  <span className="w-40 shrink-0 truncate font-medium">{r.name || "—"}</span>
                  <span className="text-muted-foreground w-40 shrink-0">{r.phone || "—"}</span>
                  <span className={`w-44 shrink-0 truncate ${r.courseName && !courseSet.has(r.courseName.toLowerCase()) ? "text-destructive" : ""}`}>
                    {r.courseName || "—"}
                  </span>
                  <Badge variant={r.valid ? "default" : "destructive"}>{r.valid ? "Ready" : "Invalid phone"}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
