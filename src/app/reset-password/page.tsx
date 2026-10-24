import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const invalid = query.error === "INVALID_TOKEN" || !token;
  return <AuthShell title="Choose a new password" description="Reset links are single-use and expire after one hour."><ResetPasswordForm token={token} invalid={invalid} /></AuthShell>;
}
