import "server-only";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const WORDS = ["orbit", "maple", "coral", "cedar", "delta", "amber", "quartz", "willow", "ember", "hazel"];

/**
 * Generates a human-shareable temporary password for auto-provisioned
 * portal accounts (student/parent, created at admission — see PRD §6.4).
 * There's no email/SMS provider wired up yet (V1 in-app notifications
 * only), so this is surfaced once in the admission UI for the Admission
 * Officer to hand off, standing in for a real invite-link flow.
 */
export function generateTempPassword(): string {
  const word = WORDS[randomInt(WORDS.length)];
  const digits = randomInt(1000, 9999);
  return `${word}-${digits}`;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
