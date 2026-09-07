import { FileQuestion } from "lucide-react";
import { ErrorScreen } from "@/components/layout/error-screen";

/** Reached by notFound() on every detail page — usually a deleted record. */
export default function NotFound() {
  return (
    <ErrorScreen
      icon={FileQuestion}
      title="Not found"
      description="This page doesn't exist, or the record it showed has since been removed."
      action={{ href: "/", label: "Back to start" }}
    />
  );
}
