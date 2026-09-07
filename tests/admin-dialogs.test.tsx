import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/batches",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/actions/academic", () => ({
  createBatch: vi.fn(async () => ({ ok: true, data: { id: "b1" } })),
  updateBatch: vi.fn(async () => ({ ok: true, data: undefined })),
  deleteBatch: vi.fn(async () => ({ ok: true, data: undefined })),
  setBatchStatus: vi.fn(async () => ({ ok: true, data: undefined })),
  createCourse: vi.fn(async () => ({ ok: true, data: { id: "c1" } })),
  updateCourse: vi.fn(async () => ({ ok: true, data: undefined })),
  deleteCourse: vi.fn(async () => ({ ok: true, data: undefined })),
  createDivision: vi.fn(async () => ({ ok: true, data: { id: "d1" } })),
  updateDivision: vi.fn(async () => ({ ok: true, data: undefined })),
  deleteDivision: vi.fn(async () => ({ ok: true, data: undefined })),
}));
vi.mock("@/lib/actions/users", () => ({
  createStaffUser: vi.fn(async () => ({ ok: true, data: { email: "a@b.c", password: "x" } })),
  updateStaffUser: vi.fn(async () => ({ ok: true, data: undefined })),
  setUserActive: vi.fn(async () => ({ ok: true, data: undefined })),
  resetStaffUserPassword: vi.fn(async () => ({ ok: true, data: { password: "x" } })),
}));

const { BatchFormDialog } = await import("@/components/admin/batches/batch-form-dialog");
const { CourseFormDialog } = await import("@/components/admin/courses/course-form-dialog");
const { DivisionFormDialog } = await import("@/components/admin/divisions/division-form-dialog");
const { UserFormDialog } = await import("@/components/admin/users/user-form-dialog");

const courses = [{ id: "c1", name: "NEET Foundation" }];
const batches = [{ id: "b1", name: "2025-26" }];

const cases = [
  { name: "Batch", open: "New batch", render: () => <BatchFormDialog /> },
  { name: "Course", open: "New course", render: () => <CourseFormDialog batches={batches} /> },
  { name: "Division", open: "New division", render: () => <DivisionFormDialog courses={courses} /> },
  { name: "User", open: "New user", render: () => <UserFormDialog /> },
];

describe.each(cases)("$name dialog", ({ open, render: renderDialog }) => {
  beforeEach(() => vi.clearAllMocks());

  it("opens", async () => {
    const user = userEvent.setup();
    render(renderDialog());

    await user.click(screen.getByRole("button", { name: open }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes when the X is clicked", async () => {
    const user = userEvent.setup();
    render(renderDialog());
    await user.click(screen.getByRole("button", { name: open }));

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(renderDialog());
    await user.click(screen.getByRole("button", { name: open }));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("can be reopened after closing", async () => {
    const user = userEvent.setup();
    render(renderDialog());
    await user.click(screen.getByRole("button", { name: open }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: open }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
