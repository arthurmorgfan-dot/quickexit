import type { Metadata } from "next";
import RecoveryForm from "@/components/auth/RecoveryForm";
import "../auth.css";
export const metadata: Metadata = {
  title: "Reset your password — QuickExit",
  robots: { index: false, follow: true },
};
export default function ResetPassword() {
  return <RecoveryForm mode="change" />;
}
