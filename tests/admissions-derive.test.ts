import { describe, expect, it } from "vitest";
import { kycProgress, KYC_DOC_LABELS } from "@/lib/admissions/kyc";
import { isFollowUpOverdue, nextFollowUpDate } from "@/lib/crm/follow-ups";

const on = new Date("2026-09-06T12:00:00.000Z");

describe("kycProgress", () => {
  it("counts a document as done only once it is verified", () => {
    const progress = kycProgress([
      { docType: "ID_PROOF", required: true, status: "VERIFIED" },
      { docType: "PHOTO", required: true, status: "SUBMITTED" },
    ]);

    expect(progress.verified).toBe(1);
    expect(progress.total).toBe(2);
  });

  it("lists the required documents still outstanding, by their display name", () => {
    const progress = kycProgress([
      { docType: "ID_PROOF", required: true, status: "VERIFIED" },
      { docType: "ADDRESS_PROOF", required: true, status: "PENDING" },
      { docType: "PHOTO", required: true, status: "REJECTED" },
    ]);

    expect(progress.missing).toEqual([KYC_DOC_LABELS.ADDRESS_PROOF, KYC_DOC_LABELS.PHOTO]);
    expect(progress.isComplete).toBe(false);
  });

  it("ignores optional documents when deciding completeness", () => {
    const progress = kycProgress([
      { docType: "ID_PROOF", required: true, status: "VERIFIED" },
      { docType: "OTHER", required: false, status: "PENDING" },
    ]);

    expect(progress.isComplete).toBe(true);
    expect(progress.missing).toEqual([]);
  });

  it("treats a rejected document as still outstanding", () => {
    const progress = kycProgress([{ docType: "ID_PROOF", required: true, status: "REJECTED" }]);

    expect(progress.isComplete).toBe(false);
  });

  it("is complete when every required document is verified", () => {
    const progress = kycProgress([
      { docType: "ID_PROOF", required: true, status: "VERIFIED" },
      { docType: "PHOTO", required: true, status: "VERIFIED" },
    ]);

    expect(progress.isComplete).toBe(true);
    expect(progress.missing).toEqual([]);
  });

  it("has nothing outstanding when no checklist exists yet", () => {
    const progress = kycProgress([]);

    expect(progress).toMatchObject({ verified: 0, total: 0, isComplete: true, missing: [] });
  });
});

describe("isFollowUpOverdue", () => {
  it("is overdue when a scheduled follow-up passed without being completed", () => {
    expect(isFollowUpOverdue([{ scheduledAt: new Date("2026-09-01"), completedAt: null }], on)).toBe(true);
  });

  it("is not overdue once that follow-up is completed", () => {
    expect(
      isFollowUpOverdue([{ scheduledAt: new Date("2026-09-01"), completedAt: new Date("2026-09-02") }], on),
    ).toBe(false);
  });

  it("is not overdue while the scheduled date is still ahead", () => {
    expect(isFollowUpOverdue([{ scheduledAt: new Date("2026-09-20"), completedAt: null }], on)).toBe(false);
  });

  it("ignores follow-ups that were never scheduled", () => {
    expect(isFollowUpOverdue([{ scheduledAt: null, completedAt: null }], on)).toBe(false);
  });

  it("is overdue if any one of several is past due", () => {
    expect(
      isFollowUpOverdue(
        [
          { scheduledAt: new Date("2026-09-20"), completedAt: null },
          { scheduledAt: new Date("2026-08-30"), completedAt: null },
        ],
        on,
      ),
    ).toBe(true);
  });

  it("is not overdue for a lead with no follow-ups at all", () => {
    expect(isFollowUpOverdue([], on)).toBe(false);
  });
});

describe("nextFollowUpDate", () => {
  it("picks the soonest pending follow-up", () => {
    const next = nextFollowUpDate(
      [
        { scheduledAt: new Date("2026-09-20"), completedAt: null },
        { scheduledAt: new Date("2026-09-10"), completedAt: null },
      ],
      on,
    );

    expect(next?.toISOString().slice(0, 10)).toBe("2026-09-10");
  });

  it("returns the overdue one when it is the soonest outstanding", () => {
    const next = nextFollowUpDate(
      [
        { scheduledAt: new Date("2026-08-30"), completedAt: null },
        { scheduledAt: new Date("2026-09-10"), completedAt: null },
      ],
      on,
    );

    expect(next?.toISOString().slice(0, 10)).toBe("2026-08-30");
  });

  it("has nothing to show when every follow-up is done", () => {
    expect(
      nextFollowUpDate([{ scheduledAt: new Date("2026-09-01"), completedAt: new Date("2026-09-02") }], on),
    ).toBeNull();
  });
});
