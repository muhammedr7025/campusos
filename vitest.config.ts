import { defineConfig } from "vitest/config";
import path from "node:path";
import "dotenv/config";

/**
 * Tests run against a real Postgres (campusos_test), not mocks: almost every
 * rule worth testing here lives in a Prisma transaction (delete guards, audit
 * rows, fee-plan generation), and a mocked client would assert nothing.
 * Only the auth/tenant boundary and Next's cache helpers are stubbed.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL ?? "postgresql://campusos@localhost:5432/campusos").replace(
    /\/campusos(\?|$)/,
    "/campusos_test$1",
  );

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    env: { DATABASE_URL: TEST_DATABASE_URL, NODE_ENV: "test" },
    // One shared test database — run files serially so they can't race.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` throws outside an RSC bundle; the modules under test
      // import it purely as a guard rail.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
