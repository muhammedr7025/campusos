"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { createSubject, updateSubject, deleteSubject } from "@/lib/actions/academic";

export type SubjectRow = { id: string; name: string };

function SubjectRowItem({ courseId, subject }: { courseId: string; subject: SubjectRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [submitting, setSubmitting] = useState(false);

  async function onSave() {
    if (name.trim().length === 0) return;
    setSubmitting(true);
    const result = await updateSubject(subject.id, { courseId, name: name.trim() });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Subject updated.");
    setEditing(false);
    router.refresh();
  }

  async function onDelete() {
    const result = await deleteSubject(subject.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Subject "${subject.name}" deleted.`);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" autoFocus />
        <Button size="sm" onClick={onSave} disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(subject.name); }}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-3">
        <span className="text-sm font-medium">{subject.name}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Edit subject" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Delete subject">
                <Trash2 className="text-destructive size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {subject.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Subjects already used in a timetable, attendance record, or assignment can&apos;t be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export function SubjectsManager({ courseId, subjects }: { courseId: string; subjects: SubjectRow[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function onAdd() {
    if (newName.trim().length === 0) return;
    setAdding(true);
    const result = await createSubject({ courseId, name: newName.trim() });
    setAdding(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Subject "${newName}" added.`);
    setNewName("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          placeholder="e.g. Physics"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <Button onClick={onAdd} disabled={adding || newName.trim().length === 0}>
          {adding ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </div>
      {subjects.length === 0 ? (
        <EmptyState icon={BookMarked} title="No subjects yet" description="Subjects feed into timetable, attendance, and assignments." />
      ) : (
        <div className="flex flex-col gap-2">
          {subjects.map((s) => (
            <SubjectRowItem key={s.id} courseId={courseId} subject={s} />
          ))}
        </div>
      )}
    </div>
  );
}
