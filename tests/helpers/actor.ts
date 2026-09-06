import type { RoleValue } from "@/lib/constants/roles";

/**
 * The signed-in user the mocked auth boundary reports for the current test.
 * Set it with `setTestActor` before exercising a server action.
 */
export const testActor: { id: string; role: RoleValue; tenantId: string; name: string; email: string } = {
  id: "",
  role: "SUPER_ADMIN",
  tenantId: "",
  name: "Test Actor",
  email: "actor@test.local",
};

export function setTestActor(patch: Partial<typeof testActor>) {
  Object.assign(testActor, patch);
}
