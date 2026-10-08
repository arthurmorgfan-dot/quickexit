import type { Metadata } from "next";
import RecoveryForm from "@/components/auth/RecoveryForm";
import "../auth.css";
export const metadata: Metadata = {
  title: "Recover your account — QuickExit",
  robots: { index: false, follow: true },
};
export default function ForgotPassword() {
  return <RecoveryForm mode="request" />;
}
