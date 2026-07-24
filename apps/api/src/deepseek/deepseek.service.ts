import { Injectable } from '@nestjs/common';
import {
  generationOutputSchema,
  plainText,
  plainTextList,
  type GenerationOutput,
} from '@anchorproposal/shared';
import { SettingsService } from '../settings/settings.service';

type GenMeta = {
  jobTitle?: string;
  company?: string;
  candidateName?: string;
  profileTitle?: string;
  profileExperiences?: Record<string, unknown>[];
};

@Injectable()
export class DeepseekService {
  constructor(private settings: SettingsService) {}

  async generate(
    prompt: string,
    meta: GenMeta = {},
  ): Promise<{ content: GenerationOutput; tokenUsage: number }> {
    const apiKey = await this.settings.getApiKey();
    if (!apiKey) {
      throw new Error(
        'DeepSeek API key not configured. Set it in Settings → AI Provider (or DEEPSEEK_API_KEY).',
      );
    }

    const model = await this.settings.getModel();

    const { parsed, tokenUsage: usage1 } = await this.chatJson(
      apiKey,
      model,
      [
        {
          role: 'system',
          content: [
            'You are a professional resume writer. Respond with valid JSON only using keys contact, summary, skills, experiences, educations, certificates.',
            'contact.title is the professional headline under the name: ground it in the candidate\'s real profile title / current role.',
            'You may lightly reflect the job domain from the JD, but NEVER copy, paraphrase, or lightly rename the target job title into contact.title (that looks fake to recruiters).',
            'CRITICAL: every item in experiences MUST include "bullets": an array of 4-8 plain strings (achievements/responsibilities). Never omit bullets. Never use nested objects for bullets.',
            'Education/certificate fields must be plain strings. No markdown fences.',
          ].join(' '),
        },
        { role: 'user', content: prompt },
      ],
    );

    let normalized = this.normalizeToPromptFormat(parsed, meta);
    let tokenUsage = usage1;

    let validated: GenerationOutput;
    try {
      validated = generationOutputSchema.parse(normalized);
    } catch (err) {
      const issues = (err as { issues?: { path: (string | number)[] }[] })?.issues;
      if (Array.isArray(issues) && issues.length) {
        const paths = issues.map((i) => i.path.join('.') || '(root)').join(', ');
        throw new Error(
          `AI output did not match the prompt resume schema (${paths}). Check the published prompt OUTPUT FORMAT.`,
        );
      }
      throw err;
    }

    validated = this.backfillBulletsFromProfile(validated, meta.profileExperiences);

    if (this.experiencesMissingBullets(validated)) {
      const repaired = await this.repairExperienceBullets(
        apiKey,
        model,
        validated,
        prompt,
        meta,
      );
      validated = repaired.content;
      tokenUsage += repaired.tokenUsage;
    }

    if (this.experiencesMissingBullets(validated)) {
      throw new Error(
        'AI returned experiences without bullet points. Please try generating again.',
      );
    }

    return { content: validated, tokenUsage };
  }

  private async chatJson(
    apiKey: string,
    model: string,
    messages: { role: string; content: string }[],
  ): Promise<{ parsed: unknown; tokenUsage: number }> {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 402) {
        throw new Error(
          'DeepSeek account has insufficient balance. Top up at https://platform.deepseek.com or update the API key in Settings → AI Provider.',
        );
      }
      throw new Error(`DeepSeek API error: ${response.status} ${err}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage?: { total_tokens: number };
    };
    const raw = data.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from DeepSeek');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Invalid JSON from DeepSeek');
      parsed = JSON.parse(jsonMatch[0]);
    }

    return { parsed, tokenUsage: data.usage?.total_tokens || 0 };
  }

  private experiencesMissingBullets(content: GenerationOutput): boolean {
    const exps = content.experiences || [];
    if (!exps.length) return false;
    return exps.some((e) => {
      const bullets = (e as Record<string, unknown>).bullets;
      return !Array.isArray(bullets) || bullets.length === 0;
    });
  }

  private backfillBulletsFromProfile(
    content: GenerationOutput,
    profileExperiences?: Record<string, unknown>[],
  ): GenerationOutput {
    if (!profileExperiences?.length) return content;
    const experiences = (content.experiences || []).map((exp) => {
      const e = exp as Record<string, unknown>;
      const existing = plainTextList(e.bullets);
      if (existing.length) return exp;

      const title = plainText(e.title).toLowerCase();
      const company = plainText(e.company).toLowerCase();
      const match = profileExperiences.find((p) => {
        const pt = plainText(p.title || p.jobTitle).toLowerCase();
        const pc = plainText(p.company || p.companyName).toLowerCase();
        return (title && pt === title) || (company && pc === company && (!title || !pt || pt === title));
      });
      if (!match) return exp;

      const bullets = [
        ...plainTextList(match.responsibilities),
        ...plainTextList(match.achievements),
        ...plainTextList(match.bullets),
      ].filter(Boolean);
      if (!bullets.length) return exp;
      return { ...e, bullets: [...new Set(bullets)] };
    });
    return { ...content, experiences };
  }

  private async repairExperienceBullets(
    apiKey: string,
    model: string,
    content: GenerationOutput,
    originalPrompt: string,
    meta: GenMeta,
  ): Promise<{ content: GenerationOutput; tokenUsage: number }> {
    const roles = (content.experiences || []).map((exp) => {
      const e = exp as Record<string, unknown>;
      return {
        title: plainText(e.title),
        company: plainText(e.company),
        dates: plainText(e.dates),
        location: plainText(e.location) || undefined,
      };
    });

    const { parsed, tokenUsage } = await this.chatJson(apiKey, model, [
      {
        role: 'system',
        content:
          'You fill missing resume experience bullets. Return JSON only with key "experiences". Each item needs title, company, dates, optional location, and bullets: 4-8 plain strings. No nested objects. No markdown.',
      },
      {
        role: 'user',
        content: [
          'The previous resume JSON omitted experience bullets.',
          'Keep the same roles/employers/dates. Write 4-8 achievement bullets per role grounded in the candidate profile and job context.',
          'Do not invent employers or date ranges.',
          '',
          'Roles to complete:',
          JSON.stringify(roles, null, 2),
          '',
          'Candidate / job context:',
          originalPrompt.slice(0, 100_000),
        ].join('\n'),
      },
    ]);

    const root =
      parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    const repairedRows = this.asObjectArray(
      root.experiences ?? root.experience,
      'title',
    ).map((row) => this.normalizeExperience(row));

    const byKey = new Map<string, Record<string, unknown>>();
    for (const row of repairedRows) {
      const key = `${plainText(row.title).toLowerCase()}|${plainText(row.company).toLowerCase()}`;
      byKey.set(key, row);
    }

    const experiences = (content.experiences || []).map((exp) => {
      const e = exp as Record<string, unknown>;
      if (plainTextList(e.bullets).length) return exp;
      const key = `${plainText(e.title).toLowerCase()}|${plainText(e.company).toLowerCase()}`;
      const hit = byKey.get(key);
      const bullets = hit ? plainTextList(hit.bullets) : [];
      if (!bullets.length) {
        // Fall back to first repaired row with matching title only
        const byTitle = repairedRows.find(
          (r) => plainText(r.title).toLowerCase() === plainText(e.title).toLowerCase(),
        );
        const tBullets = byTitle ? plainTextList(byTitle.bullets) : [];
        if (tBullets.length) return { ...e, bullets: tBullets };
        return exp;
      }
      return { ...e, bullets };
    });

    const merged = generationOutputSchema.parse({
      ...content,
      experiences,
    });
    return {
      content: this.backfillBulletsFromProfile(merged, meta.profileExperiences),
      tokenUsage,
    };
  }

  /** Keep / coerce AI JSON into the Admin prompt OUTPUT FORMAT. */
  private normalizeToPromptFormat(parsed: unknown, meta: GenMeta): unknown {
    if (!parsed || typeof parsed !== 'object') return parsed;
    const root = parsed as Record<string, unknown>;

    // Unwrap wrappers
    let obj =
      root.data && typeof root.data === 'object'
        ? (root.data as Record<string, unknown>)
        : root.result && typeof root.result === 'object'
          ? (root.result as Record<string, unknown>)
          : root;

    // Old app shape { resume: { header, ... }, coverLetter }
    if (obj.resume && typeof obj.resume === 'object') {
      obj = this.fromLegacyResume(
        obj.resume as Record<string, unknown>,
        obj.coverLetter as Record<string, unknown> | undefined,
        meta,
      );
    }

    const contactIn =
      obj.contact && typeof obj.contact === 'object'
        ? (obj.contact as Record<string, unknown>)
        : {};

    const skills = this.normalizeSkills(obj.skills);
    const experiences = this.asObjectArray(
      obj.experiences ?? obj.experience,
      'title',
    ).map((row) => this.normalizeExperience(row));
    const educations = this.asObjectArray(
      obj.educations ?? obj.education,
      'degree',
    ).map((row) => this.normalizeEducation(row));
    const certificates = this.asObjectArray(
      obj.certificates ?? obj.certifications,
      'name',
    ).map((row) => this.normalizeCertificate(row));

    const headline = this.resolveContactTitle(
      [
        plainText(contactIn.title),
        plainText(contactIn.headline),
        plainText(contactIn.professionalTitle),
        plainText(obj.title),
        plainText(obj.headline),
      ],
      meta,
      experiences,
    );

    const contact = {
      name:
        plainText(contactIn.name) ||
        plainText(meta.candidateName) ||
        'Candidate',
      title: headline,
      address: (() => {
        const a = plainText(contactIn.address || contactIn.location);
        return a || undefined;
      })(),
      email: plainText(contactIn.email) || undefined,
      phone: plainText(contactIn.phone) || undefined,
      linkedin: plainText(contactIn.linkedin) || undefined,
    };

    const out: Record<string, unknown> = {
      contact,
      summary: plainText(obj.summary),
      skills,
      experiences,
      educations,
      certificates,
    };

    if (obj.coverLetter && typeof obj.coverLetter === 'object') {
      out.coverLetter = obj.coverLetter;
    } else {
      out.coverLetter = this.defaultCoverLetter(
        contact.name,
        meta.jobTitle,
        meta.company,
      );
    }

    return out;
  }

  private fromLegacyResume(
    resume: Record<string, unknown>,
    coverLetter: Record<string, unknown> | undefined,
    meta: GenMeta,
  ): Record<string, unknown> {
    const header =
      resume.header && typeof resume.header === 'object'
        ? (resume.header as Record<string, unknown>)
        : {};
    const hc =
      header.contact && typeof header.contact === 'object'
        ? (header.contact as Record<string, unknown>)
        : {};

    const skillsRaw = Array.isArray(resume.skills) ? resume.skills : [];
    const skills = skillsRaw.map((s) => {
      if (!s || typeof s !== 'object') return { Skills: '' };
      const rec = s as Record<string, unknown>;
      if ('category' in rec) {
        const cat = plainText(rec.category) || 'Skills';
        return { [cat]: plainText(rec.items) };
      }
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(rec)) {
        out[k] = plainText(v);
      }
      return out;
    });

    return {
      contact: {
        name:
          plainText(header.name) ||
          plainText(meta.candidateName) ||
          'Candidate',
        title: this.resolveContactTitle(
          [plainText(header.title), plainText(header.headline)],
          meta,
          [],
        ),
        address: plainText(hc.location) || undefined,
        email: plainText(hc.email) || undefined,
        phone: plainText(hc.phone) || undefined,
        linkedin: plainText(hc.linkedin) || undefined,
      },
      summary: plainText(resume.summary),
      skills,
      experiences: resume.experience || resume.experiences || [],
      educations: resume.education || resume.educations || [],
      certificates: resume.certifications || resume.certificates || [],
      coverLetter,
    };
  }

  private looksLikeExperienceRow(item: unknown): boolean {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const rec = item as Record<string, unknown>;
    return [
      'title',
      'jobTitle',
      'position',
      'role',
      'company',
      'companyName',
      'employer',
      'bullets',
      'responsibilities',
      'achievements',
    ].some((k) => rec[k] != null && rec[k] !== '');
  }

  private looksLikeEducationRow(item: unknown): boolean {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const rec = item as Record<string, unknown>;
    return [
      'institution',
      'school',
      'university',
      'degree',
      'major',
      'name',
      'title',
    ].some((k) => rec[k] != null && rec[k] !== '');
  }

  private looksLikeCertificateRow(item: unknown): boolean {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const rec = item as Record<string, unknown>;
    return ['name', 'title', 'issuer', 'organization', 'org'].some(
      (k) => rec[k] != null && rec[k] !== '',
    );
  }

  private asObjectArray(raw: unknown, wrapKey: string): Record<string, unknown>[] {
    if (raw == null) return [];
    const list = Array.isArray(raw)
      ? raw
      : typeof raw === 'object'
        ? [raw]
        : typeof raw === 'string' && raw.trim()
          ? [raw]
          : [];

    const out: Record<string, unknown>[] = [];
    for (const item of list) {
      if (item == null || item === '') continue;
      if (typeof item === 'string') {
        const t = plainText(item);
        if (t) out.push({ [wrapKey]: t });
        continue;
      }
      if (Array.isArray(item)) {
        if (wrapKey === 'title') {
          if (item.some((x) => this.looksLikeExperienceRow(x))) {
            for (const nested of item) {
              if (this.looksLikeExperienceRow(nested)) {
                out.push(nested as Record<string, unknown>);
              } else if (nested != null && nested !== '') {
                const bullets = plainTextList(nested);
                if (bullets.length) out.push({ bullets });
              }
            }
          } else {
            const bullets = plainTextList(item);
            if (bullets.length) out.push({ bullets });
          }
        } else if (wrapKey === 'degree') {
          if (item.some((x) => this.looksLikeEducationRow(x))) {
            for (const nested of item) {
              if (this.looksLikeEducationRow(nested)) {
                out.push(nested as Record<string, unknown>);
              }
            }
          } else {
            const text = plainText(item);
            if (text) out.push({ [wrapKey]: text });
          }
        } else if (wrapKey === 'name') {
          if (item.some((x) => this.looksLikeCertificateRow(x))) {
            for (const nested of item) {
              if (this.looksLikeCertificateRow(nested)) {
                out.push(nested as Record<string, unknown>);
              }
            }
          } else {
            const text = plainText(item);
            if (text) out.push({ [wrapKey]: text });
          }
        } else {
          const text = plainText(item);
          if (text) out.push({ [wrapKey]: text });
        }
        continue;
      }
      if (typeof item === 'object') {
        out.push(item as Record<string, unknown>);
        continue;
      }
      const t = plainText(item);
      if (t) out.push({ [wrapKey]: t });
    }
    return out;
  }

  /**
   * Headline under the name must stay authentic to the profile.
   * Never use the target job title (HR red flag). Prefer profile title,
   * then a non-JD AI headline, then most recent experience title.
   */
  private resolveContactTitle(
    aiCandidates: string[],
    meta: GenMeta,
    experiences: Record<string, unknown>[],
  ): string | undefined {
    const profileTitle = plainText(meta.profileTitle);
    const recentRole = plainText(experiences[0]?.title);
    const aiTitle = aiCandidates
      .map((t) => plainText(t))
      .find((t) => t && !this.titlesMatchJob(t, meta.jobTitle));

    // Profile title is the authentic base — never replace with the JD job title.
    if (profileTitle) return profileTitle;
    // AI may lightly reflect JD domain only when it does not copy the job title.
    if (aiTitle) return aiTitle;
    return recentRole || undefined;
  }

  private titlesMatchJob(candidate: string, jobTitle?: string): boolean {
    if (!candidate || !jobTitle) return false;
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/\(.*?\)/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const a = norm(candidate);
    const b = norm(jobTitle);
    if (!a || !b) return false;
    if (a === b) return true;
    // Treat near-copies as JD titles (e.g. "Applied AI Engineer" vs "Applied AI Engineer (US)").
    if (a.includes(b) || b.includes(a)) return true;
    return false;
  }

  private normalizeExperience(row: Record<string, unknown>): Record<string, unknown> {
    const title =
      plainText(row.title) ||
      plainText(row.jobTitle) ||
      plainText(row.position) ||
      plainText(row.role);
    const company =
      plainText(row.company) ||
      plainText(row.companyName) ||
      plainText(row.employer) ||
      plainText(row.organization) ||
      plainText(row.org);
    const location =
      plainText(row.location) || plainText(row.companyLocation) || undefined;
    const dates =
      plainText(row.dates) ||
      (() => {
        const start = plainText(row.enterDate || row.startDate);
        const end = plainText(row.endDate);
        if (start || end) return `${start} – ${end || 'Present'}`.replace(/^\s–\s/, '').trim();
        return '';
      })();
    const bulletsFromList = plainTextList(row.bullets);
    const uniqueBullets = bulletsFromList.length
      ? [...new Set(bulletsFromList.filter(Boolean))]
      : [
          ...new Set(
            [
              ...plainTextList(row.responsibilities),
              ...plainTextList(row.achievements),
              ...plainTextList(row.highlights),
              ...plainTextList(row.duties),
              ...plainTextList(row.description),
              ...plainTextList(row.details),
              ...plainTextList(row.overview),
            ].filter(Boolean),
          ),
        ];

    const out: Record<string, unknown> = {};
    if (title) out.title = title;
    if (company) out.company = company;
    if (location) out.location = location;
    if (dates) out.dates = dates;
    if (uniqueBullets.length) out.bullets = uniqueBullets;
    const technologies = plainText(row.technologies);
    if (technologies) out.technologies = technologies;
    return out;
  }

  private normalizeEducation(row: Record<string, unknown>): Record<string, unknown> {
    const degree =
      plainText(row.degree) ||
      plainText(row.major) ||
      plainText(row.name) ||
      plainText(row.title);
    const institution =
      plainText(row.institution) ||
      plainText(row.school) ||
      plainText(row.university);
    const dates =
      plainText(row.dates) ||
      [plainText(row.startDate), plainText(row.endDate)].filter(Boolean).join(' – ');
    const location = plainText(row.location) || undefined;
    const out: Record<string, unknown> = {};
    if (degree) out.degree = degree;
    if (institution) out.institution = institution;
    if (dates) out.dates = dates;
    if (location) out.location = location;
    return out;
  }

  private normalizeCertificate(row: Record<string, unknown>): Record<string, unknown> {
    const name = plainText(row.name) || plainText(row.title);
    const issuer =
      plainText(row.issuer) ||
      plainText(row.organization) ||
      plainText(row.org);
    const date =
      plainText(row.date) ||
      plainText(row.dates) ||
      plainText(row.issueDate);
    const out: Record<string, unknown> = {};
    if (name) out.name = name;
    if (issuer) out.issuer = issuer;
    if (date) out.date = date;
    return out;
  }

  private normalizeSkills(raw: unknown): Record<string, string>[] {
    if (!Array.isArray(raw)) {
      if (raw && typeof raw === 'object') {
        return Object.entries(raw as Record<string, unknown>).map(([k, v]) => ({
          [k]: plainText(v),
        }));
      }
      return [];
    }

    return raw.map((entry) => {
      if (!entry || typeof entry !== 'object') return { Skills: '' };
      const rec = entry as Record<string, unknown>;
      if ('category' in rec || 'items' in rec) {
        const cat = plainText(rec.category) || 'Skills';
        return { [cat]: plainText(rec.items) };
      }
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(rec)) {
        out[k] = plainText(v);
      }
      return out;
    });
  }

  private defaultCoverLetter(
    name: string,
    jobTitle?: string,
    company?: string,
  ): Record<string, unknown> {
    const role = jobTitle || 'the open role';
    const at = company ? ` at ${company}` : '';
    return {
      greeting: 'Dear Hiring Manager,',
      paragraphs: [
        `I am writing to express my interest in the ${role} position${at}.`,
        'My experience and skills, as outlined in my resume, align well with what you are looking for, and I would welcome the opportunity to contribute to your team.',
        'Thank you for your time and consideration. I look forward to discussing how I can help.',
      ],
      closing: 'Sincerely,',
      signatureName: name || 'Applicant',
    };
  }

  buildPrompt(
    template: string,
    vars: {
      profileJson: string;
      jobTitle: string;
      company: string;
      jobDescription: string;
      contentPolicy?: string;
    },
  ): string {
    let profile: Record<string, unknown> = {};
    try {
      profile = JSON.parse(vars.profileJson) as Record<string, unknown>;
    } catch {
      profile = {};
    }

    const firstName = String(profile.firstName || '');
    const lastName = String(profile.lastName || '');
    const email = String(profile.email || '');
    const phone = String(profile.phone || '');
    const address = String(
      profile.address ||
        [profile.city, profile.state, profile.country].filter(Boolean).join(', ') ||
        '',
    );
    const linkedin = (() => {
      if (profile.linkedin) return String(profile.linkedin);
      const links = profile.links;
      if (Array.isArray(links)) {
        const li = links.find(
          (l) =>
            l &&
            typeof l === 'object' &&
            /linkedin/i.test(String((l as Record<string, unknown>).label || (l as Record<string, unknown>).url || '')),
        ) as Record<string, unknown> | undefined;
        if (li?.url) return String(li.url);
      }
      return '';
    })();

    const experiencesJson = JSON.stringify(profile.experiences || [], null, 2);
    const educationsJson = JSON.stringify(
      profile.educations || profile.education || [],
      null,
      2,
    );
    const certificatesJson = JSON.stringify(
      profile.certificates || profile.certifications || [],
      null,
      2,
    );
    const profileTitle = String(
      profile.profileTitle ||
        (Array.isArray(profile.experiences) &&
        profile.experiences[0] &&
        typeof profile.experiences[0] === 'object'
          ? (profile.experiences[0] as Record<string, unknown>).title
          : '') ||
        '',
    );

    return template
      .replace(/\{\{profileJson\}\}/g, vars.profileJson)
      .replace(/\{\{jobTitle\}\}/g, vars.jobTitle)
      .replace(/\{\{company\}\}/g, vars.company)
      .replace(/\{\{jobDescription\}\}/g, vars.jobDescription)
      .replace(
        /\{\{contentPolicy\}\}/g,
        vars.contentPolicy || 'Do not invent any facts not in the profile.',
      )
      .replace(/\{\{firstName\}\}/g, firstName)
      .replace(/\{\{lastName\}\}/g, lastName)
      .replace(/\{\{email\}\}/g, email)
      .replace(/\{\{phone\}\}/g, phone)
      .replace(/\{\{address\}\}/g, address)
      .replace(/\{\{linkedin\}\}/g, linkedin)
      .replace(/\{\{profileTitle\}\}/g, profileTitle)
      .replace(/\{\{experiencesJson\}\}/g, experiencesJson)
      .replace(/\{\{educationsJson\}\}/g, educationsJson)
      .replace(/\{\{certificatesJson\}\}/g, certificatesJson);
  }
}
