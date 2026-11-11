type FrameworkRequest = {
  method: string;
};

type FrameworkContext = {
  routerKind: "Pages Router" | "App Router";
  routePath: string;
  routeType: "render" | "route" | "action" | "proxy";
  renderSource?: string;
  revalidateReason?: string;
  renderType?: string;
};

const safeValue = /^[A-Za-z0-9 /_.:@()[\]-]{1,160}$/;

export function errorType(error: unknown): string {
  if (error instanceof Error && safeValue.test(error.name)) return error.name;
  return "UnknownError";
}

export function frameworkErrorFields(error: unknown, request: FrameworkRequest, context: FrameworkContext) {
  const digest = errorDigest(error);
  return {
    errorType: errorType(error),
    method: safeValue.test(request.method) ? request.method : "UNKNOWN",
    routerKind: context.routerKind,
    routePath: safeValue.test(context.routePath) ? context.routePath : "unknown",
    routeType: context.routeType,
    ...(context.renderSource && safeValue.test(context.renderSource) ? { renderSource: context.renderSource } : {}),
    ...(context.revalidateReason && safeValue.test(context.revalidateReason) ? { revalidateReason: context.revalidateReason } : {}),
    ...(context.renderType && safeValue.test(context.renderType) ? { renderType: context.renderType } : {}),
    ...(digest ? { digest } : {}),
  };
}

function errorDigest(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("digest" in error)) return undefined;
  const digest = String(error.digest);
  return safeValue.test(digest) ? digest : undefined;
}
