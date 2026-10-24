import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/sign-in-form";

export default function SignInPage() {
  return <AuthShell title="Welcome back" description="Sign in to your agency workspace."><SignInForm /></AuthShell>;
}
