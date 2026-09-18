import { ReportModel, ReportModelSchema } from './report-schema';

export function generateJsonReport(report: ReportModel): string {
  // Validate schema before serializing
  const validated = ReportModelSchema.parse(report);

  // Re-order object keys deterministically to produce clean, stable JSON diffs
  return JSON.stringify(validated, null, 2);
}
