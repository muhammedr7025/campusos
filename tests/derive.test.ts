import { describe, expect, it } from "vitest";
import { attendancePercent, PRESENT_STATUSES } from "@/lib/academics/attendance";
import { capacityState } from "@/lib/academics/capacity";

describe("attendancePercent", () => {
  it("counts present and late as attended", () => {
    expect(
      attendancePercent([{ status: "PRESENT" }, { status: "LATE" }, { status: "ABSENT" }, { status: "PRESENT" }]),
    ).toBe(75);
  });

  it("treats excused absence as not attended, matching the portal's figure", () => {
    expect(attendancePercent([{ status: "PRESENT" }, { status: "EXCUSED" }])).toBe(50);
  });

  it("rounds to the nearest whole percent", () => {
    expect(attendancePercent([{ status: "PRESENT" }, { status: "PRESENT" }, { status: "ABSENT" }])).toBe(67);
  });

  it("returns null when nothing has been marked, so callers can show a dash", () => {
    expect(attendancePercent([])).toBeNull();
  });

  it("agrees with the status list it exports", () => {
    expect([...PRESENT_STATUSES].sort()).toEqual(["LATE", "PRESENT"]);
  });
});

describe("capacityState", () => {
  it("is open with room to spare", () => {
    expect(capacityState(10, 40)).toBe("open");
  });

  it("warns once a division passes 85% full", () => {
    expect(capacityState(35, 40)).toBe("nearly-full");
  });

  it("is full at capacity", () => {
    expect(capacityState(40, 40)).toBe("full");
  });

  it("stays full if somehow over capacity", () => {
    expect(capacityState(41, 40)).toBe("full");
  });

  it("has no state when a division has no declared capacity", () => {
    expect(capacityState(12, null)).toBeNull();
  });

  it("does not divide by zero on a zero-capacity division", () => {
    expect(capacityState(0, 0)).toBe("full");
  });
});
