import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import "../auth.css";
export const metadata: Metadata = {
  title: "Create account — QuickExit",
  robots: { index: false, follow: true },
};
export default function SignUp() {
  return <AuthForm mode="signup" />;
}
