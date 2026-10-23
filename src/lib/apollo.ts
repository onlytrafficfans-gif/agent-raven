import { mapApolloStatus } from "@/lib/provider-errors";

export type ApolloCompany = {
  providerOrganizationId: string;
  name: string;
  domain: string | null;
  websiteUrl: string | null;
  website?: string | null;
  industry: string | null;
  location: string | null;
  employeeCount: number | null;
  estimatedRevenue: number | null;
  retrievedAt: string;
  source: "Apollo";
};

export type ApolloSearchInput = { industry?: string; location?: string; employeeMin?: number; employeeMax?: number; revenueMin?: number; revenueMax?: number; page: number; perPage: number };
export type ApolloSearchResult = { companies: ApolloCompany[]; page: number; perPage: number; totalEntries: number | null; usageUnits: number };

type ApolloOrganization = {
  id?: string; name?: string; website_url?: string | null; primary_domain?: string | null; industry?: string | null;
  estimated_num_employees?: number | null; organization_revenue?: number | null; annual_revenue?: number | null;
  city?: string | null; state?: string | null; country?: string | null;
};

export class ApolloClient {
  constructor(private apiKey: string, private fetcher: typeof fetch = fetch) {}

  private headers() { return { accept: "application/json", "content-type": "application/json", "x-api-key": this.apiKey }; }

  async testConnection(): Promise<void> {
    const response = await this.fetcher("https://api.apollo.io/api/v1/auth/health", { method: "GET", headers: this.headers(), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw mapApolloStatus(response.status, response.headers.get("retry-after"));
  }

  async search(input: ApolloSearchInput): Promise<ApolloSearchResult> {
    const body: Record<string, unknown> = { page: input.page, per_page: input.perPage };
    if (input.industry) body.organization_industries = [input.industry.toLowerCase()];
    if (input.location) body.organization_locations = [input.location];
    if (input.employeeMin !== undefined || input.employeeMax !== undefined) body.organization_num_employees_ranges = [`${input.employeeMin ?? 1},${input.employeeMax ?? 1000000}`];
    if (input.revenueMin !== undefined) body.revenue_range = { min: input.revenueMin, max: input.revenueMax };
    const response = await this.fetcher("https://api.apollo.io/api/v1/mixed_companies/search", { method: "POST", headers: this.headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw mapApolloStatus(response.status, response.headers.get("retry-after"));
    const data = await response.json() as { organizations?: ApolloOrganization[]; pagination?: { total_entries?: number } };
    const now = new Date().toISOString();
    return {
      companies: (data.organizations ?? []).flatMap((o) => o.id && o.name ? [{
        providerOrganizationId: o.id, name: o.name, domain: o.primary_domain ?? null, websiteUrl: o.website_url ?? null,
        industry: o.industry ?? null, location: [o.city, o.state, o.country].filter(Boolean).join(", ") || null,
        employeeCount: o.estimated_num_employees ?? null, estimatedRevenue: o.organization_revenue ?? o.annual_revenue ?? null,
        retrievedAt: now, source: "Apollo" as const,
      }] : []),
      page: input.page, perPage: input.perPage, totalEntries: data.pagination?.total_entries ?? null, usageUnits: 1,
    };
  }

  async company(providerId: string): Promise<ApolloCompany> {
    const response = await this.fetcher(`https://api.apollo.io/api/v1/organizations/${encodeURIComponent(providerId)}`, { headers: this.headers(), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw mapApolloStatus(response.status, response.headers.get("retry-after"));
    const data = await response.json() as { organization?: ApolloOrganization };
    const o = data.organization;
    if (!o?.id || !o.name) throw mapApolloStatus(503);
    return { providerOrganizationId: o.id, name: o.name, domain: o.primary_domain ?? null, websiteUrl: o.website_url ?? null, industry: o.industry ?? null, location: [o.city, o.state, o.country].filter(Boolean).join(", ") || null, employeeCount: o.estimated_num_employees ?? null, estimatedRevenue: o.organization_revenue ?? o.annual_revenue ?? null, retrievedAt: new Date().toISOString(), source: "Apollo" };
  }
}
