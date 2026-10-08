"use client";
import { useSearchParams } from "next/navigation";
export default function ConfirmationNotice() {
  const query = useSearchParams();
  return query.get("confirmation") === "failed" ? (
    <p className="qe-auth-message" role="alert">
      That confirmation link could not be completed. Open the latest email in
      the browser where you signed up, or sign in if your email is already
      confirmed.
    </p>
  ) : null;
}
