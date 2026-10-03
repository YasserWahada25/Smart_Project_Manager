/** AI-02 — GET /tasks/:id/ai/recommendations (docs/api.md § 1.17). Nothing is stored. */
export interface DeveloperRecommendation {
  developer: { id: string; firstName: string; lastName: string; email: string; jobTitle: string };
  /** 0–100 = 100 × (0.60 skills + 0.25 workload + 0.15 experience). */
  score: number;
  matchingSkills: string[];
  missingSkills: string[];
  /** Open (not done) tasks and story points of the developer, in every project. */
  openTasks: number;
  openPoints: number;
  similarCompletedTasks: number;
  breakdown: { skills: number; workload: number; experience: number };
  explanation: string;
  isAssignee: boolean;
}

export interface RecommendationResult {
  task: { id: string; title: string; requiredSkills: string[] };
  method: 'scoring';
  model: string | null;
  /** required = the task's skills; inferred = team skills found in the task text; none. */
  skillsSource: 'required' | 'inferred' | 'none';
  skills: string[];
  recommendations: DeveloperRecommendation[];
  warnings: string[];
}
