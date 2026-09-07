"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel, FieldError, FieldSeparator } from "@/components/ui/field";
import { admitStudentSchema, type AdmitStudentInput } from "@/lib/validators/admissions";
import { admitStudent, type AdmitStudentResult } from "@/lib/actions/admissions";

type CourseOption = {
  id: string;
  name: string;
  divisions: { id: string; name: string; capacity: number | null; studentCount: number }[];
};

function CredentialRow({ label, email, password }: { label: string; email: string; password: string }) {
  function copy() {
    navigator.clipboard.writeText(`${email} / ${password}`);
    toast.success("Copied to clipboard.");
  }
  return (
    <div className="bg-muted flex items-center justify-between gap-3 rounded-md p-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground truncate">{email}</p>
        <p className="text-muted-foreground">
          Temp password: <span className="font-mono">{password}</span>
        </p>
      </div>
      <Button variant="ghost" size="icon" onClick={copy} aria-label={`Copy ${label} credentials`}>
        <Copy className="size-4" />
      </Button>
    </div>
  );
}

export function AdmitStudentDialog({ courses }: { courses: CourseOption[] }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AdmitStudentResult | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdmitStudentInput>({
    resolver: zodResolver(admitStudentSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      courseId: "",
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

  async function onSubmit(values: AdmitStudentInput) {
    const res = await admitStudent(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${values.name} admitted as ${res.data.enrollmentNumber}.`);
    setResult(res.data);
    reset();
    router.refresh();
  }

  function close() {
    setOpen(false);
    setResult(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button disabled={courses.length === 0}>
          <UserPlus /> Admit student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="text-primary size-5" /> Admitted as {result.enrollmentNumber}
              </DialogTitle>
              <DialogDescription>
                Share these portal logins — there&apos;s no email/SMS delivery configured, so hand them off directly.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <CredentialRow label="Student portal" email={result.studentLogin.email} password={result.studentLogin.password} />
              {result.guardianLogin ? (
                <CredentialRow label="Parent portal" email={result.guardianLogin.email} password={result.guardianLogin.password} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  The guardian already had a portal account — their existing login still works.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Admit a student</DialogTitle>
              <DialogDescription>
                For a walk-in with no enquiry on record. A fee plan, KYC checklist and portal logins are created
                automatically — no lead record is involved.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <FieldGroup>
                <Field data-invalid={!!errors.name}>
                  <FieldLabel htmlFor="name">Student name</FieldLabel>
                  <Input id="name" {...register("name")} />
                  <FieldError errors={errors.name ? [errors.name] : undefined} />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field data-invalid={!!errors.phone}>
                    <FieldLabel htmlFor="phone">Phone</FieldLabel>
                    <Input id="phone" {...register("phone")} />
                    <FieldError errors={errors.phone ? [errors.phone] : undefined} />
                  </Field>
                  <Field data-invalid={!!errors.email}>
                    <FieldLabel htmlFor="email">Email (optional)</FieldLabel>
                    <Input id="email" type="email" {...register("email")} />
                    <FieldError errors={errors.email ? [errors.email] : undefined} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                            <SelectValue placeholder="Select a division" />
                          </SelectTrigger>
                          <SelectContent>
                            {divisions.map((d) => {
                              const full = d.capacity != null && d.studentCount >= d.capacity;
                              return (
                                <SelectItem key={d.id} value={d.id} disabled={full}>
                                  {d.name}
                                  {d.capacity != null ? ` · ${d.studentCount}/${d.capacity}${full ? " · full" : ""}` : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError errors={errors.divisionId ? [errors.divisionId] : undefined} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="dob">Date of birth</FieldLabel>
                    <Input id="dob" type="date" {...register("dob")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="address">Address</FieldLabel>
                    <Input id="address" {...register("address")} />
                  </Field>
                </div>

                <FieldSeparator />

                <Field data-invalid={!!errors.guardianName}>
                  <FieldLabel htmlFor="guardianName">Guardian name</FieldLabel>
                  <Input id="guardianName" {...register("guardianName")} />
                  <FieldError errors={errors.guardianName ? [errors.guardianName] : undefined} />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field data-invalid={!!errors.guardianPhone}>
                    <FieldLabel htmlFor="guardianPhone">Guardian phone</FieldLabel>
                    <Input id="guardianPhone" {...register("guardianPhone")} />
                    <FieldError errors={errors.guardianPhone ? [errors.guardianPhone] : undefined} />
                  </Field>
                  <Field data-invalid={!!errors.guardianEmail}>
                    <FieldLabel htmlFor="guardianEmail">Guardian email</FieldLabel>
                    <Input id="guardianEmail" type="email" {...register("guardianEmail")} />
                    <FieldError errors={errors.guardianEmail ? [errors.guardianEmail] : undefined} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="guardianRelationship">Relationship</FieldLabel>
                  <Input id="guardianRelationship" placeholder="Mother / Father / Guardian" {...register("guardianRelationship")} />
                </Field>
              </FieldGroup>
              <DialogFooter className="mt-6">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  Admit student
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
