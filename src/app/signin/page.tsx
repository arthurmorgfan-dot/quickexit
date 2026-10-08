import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import "../auth.css";
export const metadata: Metadata = {
  title: "Sign in — QuickExit",
  robots: { index: false, follow: true },
};
export default function SignIn() {
  return <AuthForm mode="signin" />;
}
