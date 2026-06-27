// ── Validation module — type contract ────────────────────────────────────
// Each quantitative engine is benchmarked against analytical or historical
// references. Results are standardized for the Research Dashboard + ML logging.

export type ValStatus = 'PASS' | 'WARN' | 'FAIL';
export type ValCategory = 'Greeks' | 'MonteCarlo' | 'HMM' | 'Dealer' | 'Ranking' | 'Risk';

export interface ValidationResult {
  id: string;
  label: string;
  category: ValCategory;
  benchmark: string;     // what it was compared against
  value: number | null;  // engine value
  reference: number | null; // benchmark value
  error: number | null;  // relative / absolute error
  ci?: [number, number]; // confidence interval where applicable
  status: ValStatus;
  note: string;
}

export interface ValidationReport {
  results: ValidationResult[];
  passRate: number;      // 0..1
  byCategory: { category: ValCategory; pass: number; total: number }[];
}
