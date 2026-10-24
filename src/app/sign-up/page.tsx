import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/sign-up-form";

export default function SignUpPage() {
  return <AuthShell title="Create your account" description="Start a secure Agent.Raven workspace."><SignUpForm /></AuthShell>;
}
