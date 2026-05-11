export type QaStatus = "pass" | "warning" | "fail";

export interface QaCheck {
  key:        string;
  status:     QaStatus;
  message:    string;
  sectionId?: string;
}

export interface QaReport {
  passed:   boolean;
  score:    number;
  pageType: "hub" | "cluster";
  checks:   QaCheck[];
}

export interface FooterLink {
  label: string;
  href:  string;
}

export interface QaValidatorInput {
  html:               string;
  pageType:           "hub" | "cluster";
  brandName:          string;
  legalName:          string;
  companyNumber:      string;
  addressLines:       string[];
  email:              string;
  privacyUrl:         string;
  termsUrl:           string;
  footerLinks?:       FooterLink[];
  primaryKeyword:     string;
  supportingKeywords: string[];
  hubPageUrl:         string;
  relatedClusterUrls: string[];
  supportingPageUrls: string[];
}
