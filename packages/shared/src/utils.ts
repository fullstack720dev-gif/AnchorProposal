export function normalizeCompany(company: string): string {
  return company
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const STARTER_WARNING_RULES = [
  { category: 'REMOTE_CONFLICT', pattern: 'onsite|on-site|in office|in-office|hybrid|local candidates|relocation required', severity: 'CONFIRM', behavior: 'CONFIRM' },
  { category: 'CLEARANCE', pattern: 'security clearance|active secret|top secret|ts/sci|clearance required', severity: 'BLOCK', behavior: 'BLOCK' },
  { category: 'TRUST_BACKGROUND', pattern: 'public trust|federal background investigation|government suitability', severity: 'ADMIN_REVIEW', behavior: 'ADMIN_REVIEW' },
  { category: 'CITIZENSHIP', pattern: 'u\\.s\\. citizen only|citizenship required|must be a citizen', severity: 'CONFIRM', behavior: 'CONFIRM' },
  { category: 'TRAVEL_LOCATION', pattern: 'weekly travel|must live near|commute required|regional territory', severity: 'INFO', behavior: 'WARN' },
] as const;

export const DEFAULT_PROMPT = `You are a professional resume writer. Generate a tailored resume as a single JSON object.

RULES:
- Use ONLY facts from the candidate profile. Do NOT invent employers, dates, degrees, certifications, or technologies.
- Output valid JSON matching the required schema. No markdown fences.

CANDIDATE PROFILE:
{{profileJson}}

TARGET JOB:
Title: {{jobTitle}}
Company: {{company}}
Job Description:
{{jobDescription}}

CONTENT POLICY:
{{contentPolicy}}

Return ONLY valid JSON using this structure exactly:
{
  "contact": {
    "name": "{{firstName}} {{lastName}}",
    "address": "{{address}}",
    "email": "{{email}}",
    "phone": "{{phone}}",
    "linkedin": "{{linkedin}}"
  },
  "summary": "string",
  "skills": [
    { "Category Name": "item1, item2, item3" }
  ],
  "experiences": [
    {{experiencesJson}}
  ],
  "educations": [
    {{educationsJson}}
  ],
  "certificates": [
    {{certificatesJson}}
  ]
}

Skill objects must use REAL category names as keys (never literal "category1").
`;
