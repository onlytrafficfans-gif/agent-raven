import { describe, expect, it } from "vitest";
import { buildProspectExportCsv } from "@/lib/prospect-export";

describe("prospect CSV export", () => {
  it("preserves quoted data and neutralizes spreadsheet formulas", () => {
    const csv = buildProspectExportCsv([{
      id: "prospect-1",
      name: '=HYPERLINK("https://malicious.example","Click")',
      normalizedDomain: "example.test",
      websiteUrl: "https://example.test",
      industry: "Roofing, Siding",
      location: "Las Vegas\nNevada",
      employeeCount: 12,
      estimatedRevenue: 900000n,
      status: "QUALIFIED",
      source: "CSV_IMPORT",
      providerName: "CSV import",
      providerOrganizationId: null,
      retrievedAt: new Date("2026-11-08T14:00:00.000Z"),
      createdAt: new Date("2026-11-08T14:01:00.000Z"),
      updatedAt: new Date("2026-11-08T14:02:00.000Z"),
      tags: [{ tag: { name: "priority" } }],
      notes: [{ body: "Owner said \"review\"", createdAt: new Date("2026-11-08T14:03:00.000Z") }],
    }]);

    expect(csv.startsWith("\uFEFFid,company_name,domain")).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""https://malicious.example"",""Click"")"');
    expect(csv).toContain('"Roofing, Siding"');
    expect(csv).toContain('"Las Vegas\nNevada"');
    expect(csv).toContain('"2026-11-08T14:03:00.000Z Owner said ""review"""');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});
