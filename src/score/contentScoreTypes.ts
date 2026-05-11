export type CategoryStatus = "excellent" | "good" | "moderate" | "weak";

export interface CategoryScore {
  key:        string;
  score:      number;
  maxScore:   number;
  percentage: number;
  status:     CategoryStatus;
  message:    string;
}

export interface ContentScoreInput {
  html:               string;
  pageType:           "hub" | "cluster";
  primaryKeyword:     string;
  supportingKeywords: string[];
  location:           string;
  serviceName:        string;
}

export interface ContentScoreReport {
  overallScore:    number;
  rating:          string;
  passed:          boolean;
  categories:      CategoryScore[];
  strengths:       string[];
  issues:          string[];
  recommendations: string[];
}
