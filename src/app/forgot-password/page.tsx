import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return <AuthShell title="Reset your password" description="We’ll send a secure, one-time reset link."><ForgotPasswordForm /></AuthShell>;
}
