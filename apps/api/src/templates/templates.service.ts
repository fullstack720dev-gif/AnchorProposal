import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  templateConfigSchema,
  type TemplateConfig,
  skillRows,
  experienceBullets,
  experienceDates,
  experienceTitle,
  experienceCompany,
  formatEducationLine,
  formatCertificateLine,
  plainText,
  type PromptResumeContent,
} from '@anchorproposal/shared';
import { AuthUser } from '../common/types/auth.types';
import { isStaff } from '../common/utils/roles.util';
import { UserRole } from '@prisma/client';

export type PreviewContent = PromptResumeContent;

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  getSamplePreviewContent(): PreviewContent {
    return {
      contact: {
        name: 'Your Name',
        title: 'Professional Title',
        address: 'City, State',
        email: 'email@example.com',
        phone: '(000) 000-0000',
        linkedin: 'linkedin.com/in/example',
      },
      summary: 'Professional summary appears here.',
      skills: [{ 'Technical Skills': 'Skill one, Skill two, Skill three' }],
      experiences: [
        {
          title: 'Job Title',
          company: 'Company Name',
          dates: 'Start – End',
          bullets: ['Responsibility or achievement.', 'Another bullet point.'],
        },
      ],
      educations: [{ institution: 'Institution', degree: 'Degree', dates: 'Start – End' }],
      certificates: [{ name: 'Certification Name', issuer: 'Issuer', date: 'Year' }],
    };
  }

  async findAllForUser(user: AuthUser) {
    if (isStaff(user.role)) {
      const [templates, assignments] = await Promise.all([
        this.prisma.templateVersion.findMany({
          where: { archivedAt: null },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.templateAssignment.findMany({
          where: { userId: user.id, activeTo: null },
          select: { templateVersionId: true, isDefault: true },
        }),
      ]);
      const defaultById = new Map(
        assignments.map((a) => [a.templateVersionId, a.isDefault] as const),
      );
      return templates
        .map((t) => ({
          ...t,
          isDefault: defaultById.get(t.id) === true,
        }))
        .sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
    }

    const assignments = await this.prisma.templateAssignment.findMany({
      where: { userId: user.id, activeTo: null },
      include: {
        templateVersion: true,
      },
    });

    return assignments
      .filter((a) => a.templateVersion.isPublished && !a.templateVersion.archivedAt)
      .map((a) => ({
        ...a.templateVersion,
        isDefault: a.isDefault,
      }))
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
  }

  /** @deprecated Prefer findAllForUser */
  async findAll(publishedOnly = false) {
    return this.prisma.templateVersion.findMany({
      where: {
        archivedAt: null,
        ...(publishedOnly ? { isPublished: true } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async checkAccess(templateVersionId: string, user: AuthUser) {
    const template = await this.prisma.templateVersion.findUnique({ where: { id: templateVersionId } });
    if (!template || template.archivedAt) {
      throw new NotFoundException('Template not found');
    }
    if (isStaff(user.role)) return template;

    if (!template.isPublished) {
      throw new ForbiddenException('Bidders may only use published templates');
    }
    const assignment = await this.prisma.templateAssignment.findFirst({
      where: { userId: user.id, templateVersionId, activeTo: null },
    });
    if (!assignment) {
      throw new ForbiddenException('Template is not assigned to you');
    }
    return template;
  }

  async resolveDefaultTemplateId(user: AuthUser): Promise<string | undefined> {
    if (user.role === UserRole.BIDDER || isStaff(user.role)) {
      const assignments = await this.prisma.templateAssignment.findMany({
        where: { userId: user.id, activeTo: null },
        include: {
          templateVersion: { select: { id: true, isPublished: true, archivedAt: true } },
        },
        orderBy: { activeFrom: 'asc' },
      });
      const usable = assignments.filter(
        (a) => a.templateVersion.isPublished && !a.templateVersion.archivedAt,
      );
      const preferred = usable.find((a) => a.isDefault) || usable[0];
      if (preferred) return preferred.templateVersionId;
      if (user.role === UserRole.BIDDER) return undefined;
    }

    const defaultTemplate = await this.prisma.templateVersion.findFirst({
      where: { isPublished: true, archivedAt: null },
      orderBy: { publishedAt: 'desc' },
    });
    return defaultTemplate?.id;
  }

  async setDefaultTemplate(templateVersionId: string, user: AuthUser) {
    const template = await this.prisma.templateVersion.findUnique({
      where: { id: templateVersionId },
    });
    if (!template || template.archivedAt) {
      throw new NotFoundException('Template not found');
    }
    if (!template.isPublished) {
      throw new BadRequestException('Only published templates can be set as default');
    }

    await this.prisma.templateAssignment.updateMany({
      where: { userId: user.id, activeTo: null },
      data: { isDefault: false },
    });

    const existing = await this.prisma.templateAssignment.findUnique({
      where: {
        userId_templateVersionId: { userId: user.id, templateVersionId },
      },
    });

    if (existing) {
      await this.prisma.templateAssignment.update({
        where: { id: existing.id },
        data: { isDefault: true, activeTo: null },
      });
    } else {
      await this.prisma.templateAssignment.create({
        data: { userId: user.id, templateVersionId, isDefault: true },
      });
    }

    return { success: true, templateId: templateVersionId, isDefault: true };
  }

  async findOne(id: string) {
    const template = await this.prisma.templateVersion.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async create(data: { name: string; preset?: string; configJson?: object }) {
    return this.prisma.templateVersion.create({
      data: {
        name: data.name,
        preset: data.preset,
        configJson: data.configJson || templateConfigSchema.parse({}),
      },
    });
  }

  async update(id: string, data: { name?: string; configJson?: object }) {
    return this.prisma.templateVersion.update({ where: { id }, data });
  }

  async publish(id: string) {
    return this.prisma.templateVersion.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
    });
  }

  async clone(id: string) {
    const original = await this.findOne(id);
    return this.create({
      name: `${original.name} (Copy)`,
      preset: original.preset || undefined,
      configJson: original.configJson as object,
    });
  }

  async archive(id: string) {
    await this.findOne(id);
    return this.prisma.templateVersion.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  private parseConfig(config: object): TemplateConfig {
    try {
      return templateConfigSchema.parse(config ?? {});
    } catch {
      return templateConfigSchema.parse({});
    }
  }

  renderPreviewHtml(content: object, config: object): string {
    const c = content as PreviewContent;
    const cfg = this.parseConfig(config);

    const primary = cfg.colors.primary;
    const heading = cfg.colors.heading;
    const body = cfg.colors.body;
    const accent = cfg.colors.accent;
    const divider = cfg.colors.divider;
    const sectionLabelBg = cfg.colors.sectionLabelBg;
    const sectionLabelText = cfg.colors.sectionLabelText;
    const bodyFont = cfg.typography.bodyFont || 'Georgia, serif';
    const headingFont = cfg.typography.headingFont || bodyFont;
    const fontSize = cfg.typography.baseFontSize;
    const headingScale = cfg.typography.headingScale;
    const lineHeight = cfg.typography.lineHeight;
    const letterSpacing = cfg.typography.letterSpacing;
    const nameUppercase = cfg.typography.nameUppercase;
    const headingUppercase = cfg.typography.headingUppercase;
    const {
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      sectionSpacing,
      headerAlignment,
      pageSize,
    } = cfg.layout;
    const {
      sectionHeadingStyle,
      listStyle,
      skillsLayout,
      showDividers,
      experienceTitleWeight,
    } = cfg.styles;

    const isA4 = pageSize === 'A4';
    const pageWidth = isA4 ? '210mm' : '8.5in';
    const pageHeight = isA4 ? '297mm' : '11in';
    const visibility = cfg.sections.visibility;
    const order = cfg.sections.order?.length
      ? cfg.sections.order
      : ['summary', 'skills', 'experience', 'education', 'certifications'];

    const skills = skillRows(c.skills || []);
    const listCss =
      listStyle === 'none'
        ? 'list-style: none; padding-left: 0;'
        : listStyle === 'dash'
          ? 'list-style: none; padding-left: 14px;'
          : `list-style-type: ${listStyle}; padding-left: 18px;`;

    const liBefore =
      listStyle === 'dash'
        ? `li::before { content: "–"; position: absolute; left: 0; color: ${heading}; } li { position: relative; padding-left: 12px; }`
        : '';

    let h2Extra = '';
    if (sectionHeadingStyle === 'background') {
      h2Extra = `
        background: ${sectionLabelBg};
        color: ${sectionLabelText};
        border-bottom: none;
        padding: 4px 8px;
        border-radius: 2px;
      `;
    } else if (sectionHeadingStyle === 'bar') {
      h2Extra = `
        border-bottom: none;
        border-left: 3px solid ${accent};
        padding: 2px 0 2px 8px;
        color: ${sectionLabelText || heading};
      `;
    } else if (sectionHeadingStyle === 'plain') {
      h2Extra = `
        border-bottom: none;
        padding-bottom: 0;
      `;
    } else {
      h2Extra = showDividers
        ? `border-bottom: 1px solid ${divider};`
        : `border-bottom: none;`;
    }

    const renderSkills = () => {
      if (!skills.length || visibility.skills === false) return '';
      if (skillsLayout === 'bullets') {
        return `<section class="section"><h2>Technical Skills</h2><ul>${skills
          .map((s) => `<li><span class="skill-cat">${s.category}:</span> ${s.items}</li>`)
          .join('')}</ul></section>`;
      }
      if (skillsLayout === 'lines') {
        return `<section class="section"><h2>Technical Skills</h2>${skills
          .map(
            (s) =>
              `<div class="skill-row"><span class="skill-cat">${s.category}</span><div>${s.items}</div></div>`,
          )
          .join('')}</section>`;
      }
      return `<section class="section"><h2>Technical Skills</h2>${skills
        .map(
          (s) =>
            `<div class="skill-row"><span class="skill-cat">${s.category}:</span> ${s.items}</div>`,
        )
        .join('')}</section>`;
    };

    const sectionHtml: Record<string, string> = {
      summary:
        c.summary && visibility.summary !== false
          ? `<section class="section"><h2>Professional Summary</h2><p>${c.summary}</p></section>`
          : '',
      skills: renderSkills(),
      experience:
        c.experiences?.length && visibility.experience !== false
          ? `<section class="section"><h2>Professional Experience</h2>${c.experiences
              .map((e) => {
                const bullets = experienceBullets(e);
                const dates = experienceDates(e);
                const loc = plainText(e.location || e.companyLocation);
                return `<div class="exp"><div class="exp-header"><span class="exp-title">${experienceTitle(e)} — ${experienceCompany(e)}</span><span class="dates">${dates}</span></div>${
                  loc ? `<div class="exp-loc">${loc}</div>` : ''
                }${
                  bullets.length
                    ? `<ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`
                    : ''
                }</div>`;
              })
              .join('')}</section>`
          : '',
      education:
        c.educations?.length && visibility.education !== false
          ? `<section class="section"><h2>Education</h2>${c.educations
              .map((e) => {
                const line = formatEducationLine(e);
                return line ? `<div class="edu">${line}</div>` : '';
              })
              .join('')}</section>`
          : '',
      certifications:
        c.certificates?.length && visibility.certifications !== false
          ? `<section class="section"><h2>Certifications</h2>${c.certificates
              .map((cert) => {
                const line = formatCertificateLine(cert);
                return line ? `<div class="cert">${line}</div>` : '';
              })
              .join('')}</section>`
          : '',
    };

    const sectionsBody = order.map((key) => sectionHtml[key] || '').join('');
    const h1Size = Math.round(fontSize * headingScale * 1.65);
    const h2Size = Math.round(fontSize * headingScale * 0.95);
    const contact = c.contact || { name: 'Candidate' };
    const headline = contact.title ? String(contact.title) : '';
    const contactLine = [contact.address, contact.email, contact.phone, contact.linkedin]
      .filter(Boolean)
      .join(' · ');
    const pageSizeCss = isA4 ? 'A4' : 'Letter';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page {
        size: ${pageSizeCss};
        margin: ${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px;
      }
      html, body { margin: 0; padding: 0; background: transparent; }
      .page {
        box-sizing: border-box;
        width: ${pageWidth};
        margin: 0 auto;
        background: #fff;
        font-family: ${bodyFont}, "Times New Roman", Times, serif;
        font-size: ${fontSize}pt;
        line-height: ${lineHeight};
        letter-spacing: ${letterSpacing}px;
        color: ${body};
        -webkit-font-smoothing: antialiased;
      }
      @media screen {
        .page {
          min-height: ${pageHeight};
          padding: ${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px;
        }
      }
      @media print {
        html, body, .page {
          width: auto;
          min-height: 0;
          margin: 0;
          padding: 0;
        }
      }
      .header { text-align: ${headerAlignment}; margin-bottom: ${sectionSpacing}px; }
      h1 {
        font-family: ${headingFont}, ${bodyFont}, serif;
        color: ${primary};
        margin: 0;
        font-size: ${h1Size}pt;
        font-weight: 700;
        letter-spacing: 0.02em;
        line-height: 1.15;
        text-transform: ${nameUppercase ? 'uppercase' : 'none'};
      }
      .headline {
        margin-top: 4px;
        font-size: ${Math.round(fontSize * 1.05)}pt;
        font-weight: 600;
        color: ${heading};
        letter-spacing: 0.01em;
      }
      h2 {
        font-family: ${headingFont}, ${bodyFont}, serif;
        color: ${heading};
        font-size: ${h2Size}pt;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: ${headingUppercase !== false ? 'uppercase' : 'none'};
        padding-bottom: 3px;
        margin: 0 0 6px;
        break-after: avoid;
        page-break-after: avoid;
        ${h2Extra}
      }
      .section { margin-top: ${sectionSpacing}px; break-inside: auto; page-break-inside: auto; }
      .section:first-of-type { margin-top: 0; }
      .contact {
        font-size: ${Math.max(8, fontSize - 1.5)}pt;
        color: ${body};
        opacity: 0.85;
        margin-top: 4px;
      }
      .skill-row { margin: 2px 0; }
      .skill-cat { font-weight: 700; color: ${heading}; }
      ul { margin: 3px 0 0; ${listCss} }
      li { margin: 1px 0; }
      ${liBefore}
      .exp { margin-bottom: 8px; break-inside: auto; page-break-inside: auto; }
      .exp-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: baseline;
        break-after: avoid;
        page-break-after: avoid;
      }
      .exp-title {
        font-weight: ${experienceTitleWeight === 'normal' ? 400 : 700};
        color: ${heading};
      }
      .exp-loc {
        font-size: ${Math.max(8, fontSize - 1)}pt;
        opacity: 0.75;
        margin: 1px 0 2px;
        break-after: avoid;
        page-break-after: avoid;
      }
      .dates {
        font-weight: 400;
        font-size: ${Math.max(8, fontSize - 1)}pt;
        color: ${body};
        opacity: 0.7;
        white-space: nowrap;
      }
      .edu-degree { font-weight: 700; color: ${heading}; }
      .edu-dates { opacity: 0.75; }
      p { margin: 0; }
    </style></head><body>
      <div class="page">
        <div class="header">
          <h1>${contact.name || 'Candidate Name'}</h1>
          ${headline ? `<div class="headline">${headline}</div>` : ''}
          <div class="contact">${contactLine}</div>
        </div>
        ${sectionsBody}
      </div>
    </body></html>`;
  }
}
