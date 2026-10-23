import { z } from "zod";

const optionalInt = z.coerce.number().int().nonnegative().optional();

export const companySearchSchema = z.object({
  industry: z.string().trim().max(120).optional(),
  location: z.string().trim().max(160).optional(),
  employeeMin: optionalInt,
  employeeMax: optionalInt,
  revenueMin: optionalInt,
  revenueMax: optionalInt,
  page: z.coerce.number().int().min(1).max(500).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
}).superRefine((v, ctx) => {
  if (!v.industry && !v.location && v.employeeMin === undefined && v.revenueMin === undefined) ctx.addIssue({ code: "custom", message: "Add at least one search criterion." });
  if (v.employeeMin !== undefined && v.employeeMax !== undefined && v.employeeMin > v.employeeMax) ctx.addIssue({ code: "custom", path: ["employeeMax"], message: "Maximum employees must be at least the minimum." });
  if (v.revenueMin !== undefined && v.revenueMax !== undefined && v.revenueMin > v.revenueMax) ctx.addIssue({ code: "custom", path: ["revenueMax"], message: "Maximum revenue must be at least the minimum." });
});

export const integrationCredentialSchema = z.object({ apiKey: z.string().trim().min(12).max(500) });

export const saveProspectSchema = z.object({
  providerName: z.enum(["Apollo", "CSV import"]),
  providerOrganizationId: z.string().trim().min(1).max(160).optional(),
  name: z.string().trim().min(1).max(240),
  domain: z.string().trim().max(500).optional(),
  websiteUrl: z.string().url().optional(),
  industry: z.string().trim().max(160).optional(),
  location: z.string().trim().max(240).optional(),
  employeeCount: optionalInt,
  estimatedRevenue: z.coerce.number().int().nonnegative().optional(),
  retrievedAt: z.coerce.date(),
  provenance: z.record(z.string(), z.unknown()),
});

export const prospectStatusSchema = z.enum(["NEW", "REVIEWING", "QUALIFIED", "REJECTED"]);
export type ProspectStatusValue = z.infer<typeof prospectStatusSchema>;

export const prospectUpdateSchema = z.object({
  status: prospectStatusSchema.optional(),
  note: z.string().trim().min(1).max(4000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});
