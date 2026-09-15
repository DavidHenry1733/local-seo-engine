
export interface BusinessIntelligence {
  businessName: string;
  positioning: string;
  trustSignals: string[];
  customerProblems: string[];
  customerGoals: string[];
  differentiators: string[];
  authorityPhrases: string[];
}

export function buildBusinessIntelligencePrompt(): string {
  return `
BUSINESS INTELLIGENCE

Business Name:
InboxingProWeb

Positioning:
Helping local businesses improve visibility, generate enquiries and grow online.

Trust Signals:
- Trading since 2013
- 250+ websites built
- 400+ hosting clients
- 14 day money back guarantee

Customer Problems:
- Poor visibility
- Few enquiries
- Competitors ranking above them
- Outdated websites
- Lack of trust online

Customer Goals:
- Improve visibility
- Generate more enquiries
- Build trust
- Grow their business

Differentiators:
- Local business specialists
- Visibility-first approach
- Affordable solutions
- UK hosting infrastructure

Authority Phrases:
- After helping local businesses since 2013...
- One of the most common issues we see...
- Many business owners tell us...
- Businesses often assume...

CONTENT INSTRUCTIONS

Use trust signals naturally throughout the content.

Reference experience where relevant.

Use customer frustrations naturally.

Use authority phrases occasionally.

Do not invent additional claims, awards, reviews or statistics.

The content should sound like an experienced business consultant, not a generic AI writer.
`;
}

