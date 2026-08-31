"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel, FieldError, FieldSeparator } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { convertLeadSchema, type ConvertLeadInput } from "@/lib/validators/admissions";
import { convertLead, type ConvertLeadResult } from "@/lib/actions/admissions";

type CourseOption = { id: string; name: string; divisions: { id: string; name: string; capacity: number | null; studentCount: number }[] };

function CredentialRow({ label, email, password }: { label: string; email: string; password: string }) {
  function copy() {
    navigator.clipboard.writeText(`${email} / ${password}`);
    toast.success("Copied to clipboard.");
  }
  return (
    <div className="bg-muted flex items-center justify-between rounded-md p-3 text-sm">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">{email}</p>
        <p className="text-muted-foreground">Temp password: <span className="font-mono">{password}</span></p>
      </div>
      <Button variant="ghost" size="icon" onClick={copy} aria-label={`Copy ${label} credentials`}>
        <Copy className="size-4" />
      </Button>
    </div>
  );
}

export function ConvertLeadForm({
  leadId,
  leadName,
  defaultCourseId,
  courses,
}: {
  leadId: string;
  leadName: string;
  defaultCourseId?: string;
  courses: CourseOption[];
}) {
  const [result, setResult] = useState<ConvertLeadResult | null>(null);
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ConvertLeadInput>({
    resolver: zodResolver(convertLeadSchema),
    defaultValues: {
      leadId,
      courseId: defaultCourseId ?? "",
      divisionId: "",
      dob: "",
      address: "",
      guardianName: "",
      guardianPhone: "",
      guardianEmail: "",
      guardianRelationship: "",
    },
  });

  const selectedCourseId = watch("courseId");
  const divisions = useMemo(
    () => courses.find((c) => c.id === selectedCourseId)?.divisions ?? [],
    [courses, selectedCourseId],
  );

  async function onSubmit(values: ConvertLeadInput) {
    const res = await convertLead(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${leadName} admitted as ${res.data.enrollmentNumber}.`);
    setResult(res.data);
  }

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckCircle2 className="text-primary" /> Admission complete</CardTitle>
          <CardDescription>
            {leadName} is enrolled as <strong>{result.enrollmentNumber}</strong>. Share these portal logins — there&apos;s no
            email/SMS delivery configured yet, so hand them off directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CredentialRow label="Student portal" email={result.studentLogin.email} password={result.studentLogin.password} />
          {result.guardianLogin && (
            <CredentialRow label="Parent portal" email={result.guardianLogin.email} password={result.guardianLogin.password} />
          )}
          <Button asChild className="mt-2 w-fit">
            <Link href={`/admissions/students/${result.studentId}`}>Go to student profile</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.courseId}>
          <FieldLabel htmlFor="courseId">Course</FieldLabel>
          <Controller
            control={control}
            name="courseId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="courseId" className="w-full">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={errors.courseId ? [errors.courseId] : undefined} />
        </Field>

        <Field data-invalid={!!errors.divisionId}>
          <FieldLabel htmlFor="divisionId">Division</FieldLabel>
          <Controller
            control={control}
            name="divisionId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={divisions.length === 0}>
                <SelectTrigger id="divisionId" className="w-full">
                  <SelectValue placeholder={divisions.length === 0 ? "Choose a course first" : "Select a division"} />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((d) => {
                    const full = d.capacity != null && d.studentCount >= d.capacity;
                    return (
                      <SelectItem key={d.id} value={d.id} disabled={full}>
                        {d.name} {d.capacity != null ? `(${d.studentCount}/${d.capacity}${full ? " — full" : ""})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={errors.divisionId ? [errors.divisionId] : undefined} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="dob">Date of birth</FieldLabel>
            <Input id="dob" type="date" {...register("dob")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="address">Address</FieldLabel>
            <Input id="address" {...register("address")} />
          </Field>
        </div>

        <FieldSeparator>Parent / Guardian</FieldSeparator>

        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.guardianName}>
            <FieldLabel htmlFor="guardianName">Name</FieldLabel>
            <Input id="guardianName" {...register("guardianName")} />
            <FieldError errors={errors.guardianName ? [errors.guardianName] : undefined} />
          </Field>
          <Field data-invalid={!!errors.guardianPhone}>
            <FieldLabel htmlFor="guardianPhone">Phone</FieldLabel>
            <Input id="guardianPhone" {...register("guardianPhone")} />
            <FieldError errors={errors.guardianPhone ? [errors.guardianPhone] : undefined} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.guardianEmail}>
            <FieldLabel htmlFor="guardianEmail">Email (optional)</FieldLabel>
            <Input id="guardianEmail" type="email" {...register("guardianEmail")} />
            <FieldError errors={errors.guardianEmail ? [errors.guardianEmail] : undefined} />
          </Field>
          <Field>
            <FieldLabel htmlFor="guardianRelationship">Relationship</FieldLabel>
            <Input id="guardianRelationship" placeholder="Mother, Father, Guardian…" {...register("guardianRelationship")} />
          </Field>
        </div>
        <p className="text-muted-foreground text-xs">
          If a guardian with this phone number already exists, the new student links to their existing account instead of creating a duplicate.
        </p>
      </FieldGroup>

      <Button type="submit" disabled={isSubmitting} className="mt-6">
        {isSubmitting && <Loader2 className="animate-spin" />}
        Complete admission
      </Button>
    </form>
  );
}
