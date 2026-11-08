export const prospectExportLimit = 5_000;

export type ExportProspect = {
  id: string;
  name: string;
  normalizedDomain: string | null;
  websiteUrl: string | null;
  industry: string | null;
  location: string | null;
  employeeCount: number | null;
  estimatedRevenue: bigint | null;
  status: string;
  source: "APOLLO" | "CSV_IMPORT";
  providerName: string;
  providerOrganizationId: string | null;
  retrievedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  tags: { tag: { name: string } }[];
  notes: { body: string; createdAt: Date }[];
};

const columns = [
  "id",
  "company_name",
  "domain",
  "website_url",
  "industry",
  "location",
  "employee_count",
  "estimated_revenue",
  "status",
  "source",
  "provider_name",
  "provider_organization_id",
  "retrieved_at",
  "created_at",
  "updated_at",
  "tags",
  "notes",
] as const;

export function buildProspectExportCsv(prospects: ExportProspect[]): string {
  const rows = prospects.map((prospect) => [
    prospect.id,
    prospect.name,
    prospect.normalizedDomain,
    prospect.websiteUrl,
    prospect.industry,
    prospect.location,
    prospect.employeeCount,
    prospect.estimatedRevenue,
    prospect.status,
    prospect.source === "CSV_IMPORT" ? "CSV import" : "Apollo",
    prospect.providerName,
    prospect.providerOrganizationId,
    prospect.retrievedAt.toISOString(),
    prospect.createdAt.toISOString(),
    prospect.updatedAt.toISOString(),
    prospect.tags.map(({ tag }) => tag.name).join("; "),
    prospect.notes.map(({ body, createdAt }) => `${createdAt.toISOString()} ${body}`).join("\n---\n"),
  ]);
  return `\uFEFF${[columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function csvCell(value: string | number | bigint | null): string {
  const raw = value === null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
