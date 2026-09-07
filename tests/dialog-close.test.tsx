import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** The shape every form dialog in the app uses: controlled open state, a
 *  header, and a form whose submit button lives in the footer. */
function ControlledFormDialog({ onSubmit }: { onSubmit?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create batch</DialogTitle>
          <DialogDescription>Academic-year cohort.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.();
          }}
        >
          <input aria-label="Name" defaultValue="2025-26" />
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A dialog with more fields than fit on a short screen. */
function TallDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Admit a student</DialogTitle>
        </DialogHeader>
        <form>
          {Array.from({ length: 20 }, (_, i) => (
            <input key={i} aria-label={`Field ${i}`} />
          ))}
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

describe("a dialog taller than the viewport", () => {
  it("caps its own height and scrolls internally, so the close button stays on screen", async () => {
    const user = userEvent.setup();
    render(<TallDialog />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    const content = screen.getByRole("dialog");

    // Without these the dialog grows past the top of the window and the X —
    // positioned at its top-right — becomes unreachable, with body scroll
    // locked behind the overlay.
    expect(content.className).toMatch(/max-h-/);
    expect(content.className).toMatch(/overflow-y-auto/);
  });

  it("still closes from the X", async () => {
    const user = userEvent.setup();
    render(<TallDialog />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("the close button on a form dialog", () => {
  it("opens from its trigger", async () => {
    const user = userEvent.setup();
    render(<ControlledFormDialog />);

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes when the X is clicked", async () => {
    const user = userEvent.setup();
    render(<ControlledFormDialog />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not submit the form when the X is clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ControlledFormDialog onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<ControlledFormDialog />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("can be reopened after closing", async () => {
    const user = userEvent.setup();
    render(<ControlledFormDialog />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("still submits when the actual submit button is used", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ControlledFormDialog onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
