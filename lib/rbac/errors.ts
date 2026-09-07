/**
 * Guard errors live apart from the guard itself so anything may check for
 * them with `instanceof` — including code that must not pull in `auth`,
 * and tests that replace the guard with a stub.
 */
export class UnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do this") {
    super(message);
    this.name = "ForbiddenError";
  }
}
