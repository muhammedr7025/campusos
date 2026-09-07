"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorScreen } from "@/components/layout/error-screen";

/**
 * Anything a page throws lands here instead of the browser's bare error
 * page. It doesn't try to tell error types apart: in production Next
 * redacts a server error's name and message before it reaches the client,
 * leaving only a digest — which is why the guards redirect rather than
 * throw for the two cases users actually hit (no session, wrong role).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      icon={AlertTriangle}
      title="Something went wrong"
      description={
        error.digest
          ? `This page couldn't load. Quote reference ${error.digest} if you report it.`
          : "This page couldn't load. Trying again often works; if it doesn't, please report it."
      }
      action={{ href: "/", label: "Back to start" }}
    >
      <Button onClick={reset}>Try again</Button>
    </ErrorScreen>
  );
}
