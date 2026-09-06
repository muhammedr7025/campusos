import { redirect } from "next/navigation";

/** Superseded by the conversion queue and the KYC tracker, which the design keeps separate. */
export default function PendingKycPage() {
  redirect("/admissions/queue");
}
