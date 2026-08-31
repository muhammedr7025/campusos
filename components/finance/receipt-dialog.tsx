"use client";

import { useState } from "react";
import { Printer, Receipt as ReceiptIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export function ReceiptDialog({
  tenantName,
  studentName,
  enrollmentNumber,
  amount,
  mode,
  paidAt,
  collectedBy,
  receiptNo,
}: {
  tenantName: string;
  studentName: string;
  enrollmentNumber: string;
  amount: number;
  mode: string;
  paidAt: string;
  collectedBy: string;
  receiptNo: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" aria-label="View receipt" onClick={() => setOpen(true)}>
        <ReceiptIcon className="size-4" />
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
        </DialogHeader>
        <div className="receipt-printable flex flex-col gap-3 text-sm">
          <div className="text-center">
            <p className="font-semibold">{tenantName}</p>
            <p className="text-muted-foreground text-xs">Receipt #{receiptNo}</p>
          </div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span>{studentName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Enrollment #</span><span>{enrollmentNumber}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">₹{amount.toLocaleString("en-IN")}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span>{mode.replace("_", " ")}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{paidAt}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Collected by</span><span>{collectedBy}</span></div>
        </div>
        <Button onClick={() => window.print()} className="mt-2">
          <Printer /> Print
        </Button>
      </DialogContent>
    </Dialog>
  );
}
