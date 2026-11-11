import type { Instrumentation } from "next";
import { logEvent } from "@/lib/logger";
import { frameworkErrorFields } from "@/lib/observability";

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logEvent("error", "server.request_error", frameworkErrorFields(error, request, context));
};
