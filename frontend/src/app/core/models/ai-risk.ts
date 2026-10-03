/** AI-03 — GET /sprints/:id/ai/risk (docs/api.md § 1.17). Computed on demand, never stored. */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export interface RiskFactor {
  code: string;
  label: string;
  /** Contribution to the log-odds of a delay. */
  impact: number;
}

export interface SprintRisk {
  sprint: { id: string; name: string; status: string; startDate: string; endDate: string };
  asOf: string;
  riskLevel: RiskLevel;
  /** Probability that story points are left at the end date (0–1). */
  probability: number;
  /** model = logistic regression; rule = obvious case (no task, all done, end date passed). */
  method: 'model' | 'rule';
  factors: RiskFactor[];
  measures: {
    total: number;
    done: number;
    blocked: number;
    highComplexityOpen: number;
    unassignedOpen: number;
    totalPoints: number;
    donePoints: number;
    teamSize: number;
    historicalVelocity: number | null;
  };
  features: Record<string, number>;
  model: { name: string; version?: number; accuracy?: number; rocAuc?: number; f1?: number };
  warnings: string[];
}
