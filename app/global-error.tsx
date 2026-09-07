"use client";

/**
 * Last resort: an error in the root layout itself, where the normal error
 * boundary (which renders inside that layout) can't help. It must ship its
 * own <html>/<body>, and can't rely on the app's fonts or providers.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: ".5rem" }}>CampusOS couldn&apos;t start this page</h1>
          <p style={{ color: "#6E6A61", marginBottom: "1.5rem" }}>Please try again in a moment.</p>
          <button
            onClick={reset}
            style={{ padding: ".5rem 1rem", borderRadius: ".5rem", border: "1px solid #DDD8CD", background: "#10151A", color: "#F5F3EE", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
