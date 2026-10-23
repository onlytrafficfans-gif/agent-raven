import { redirect } from "next/navigation";
import { optionalContext } from "@/lib/authorization";
import { AppShell } from "@/components/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context=await optionalContext();
  if(!context) redirect("/sign-in");
  return <AppShell organizationName={context.organizationName} role={context.role}>{children}</AppShell>;
}
