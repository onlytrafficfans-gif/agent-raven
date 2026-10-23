import { redirect } from "next/navigation";
import { optionalContext, type RequestContext } from "@/lib/authorization";

export async function requirePageContext(): Promise<RequestContext> {
  const context = await optionalContext();
  if (!context) redirect("/sign-in");
  return context;
}
