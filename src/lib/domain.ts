import { domainToASCII } from "node:url";
import { getDomain } from "tldts";

export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const trimmed = input.trim();
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let hostname: string;
  try { hostname = new URL(withScheme).hostname; } catch { return null; }
  hostname = hostname.replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();
  const ascii = domainToASCII(hostname);
  if (!ascii || ascii.length > 253) return null;
  return getDomain(ascii, { allowPrivateDomains: false }) ?? ascii;
}
