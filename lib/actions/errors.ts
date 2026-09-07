/**
 * A rule the user broke, phrased for the user: "This payment has already
 * been corrected." Distinct from an unexpected throw, which must never reach
 * anyone's screen — see actionError in ./types.
 */
export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}
