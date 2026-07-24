import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeCompany } from '@anchorproposal/shared';
import { WarningCategory, WarningSeverity, WarningBehavior } from '@prisma/client';

export interface WarningMatch {
  category: WarningCategory;
  matchedText: string;
  severity: WarningSeverity;
  behavior: WarningBehavior;
}

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

  async getRules() {
    return this.prisma.warningRule.findMany({ where: { isActive: true } });
  }

  async createRule(data: {
    category: WarningCategory;
    pattern: string;
    severity: WarningSeverity;
    behavior: WarningBehavior;
  }) {
    return this.prisma.warningRule.create({ data });
  }

  async updateRule(id: string, data: Partial<{ pattern: string; severity: WarningSeverity; behavior: WarningBehavior; isActive: boolean }>) {
    return this.prisma.warningRule.update({ where: { id }, data });
  }

  scanText(text: string, rules: Awaited<ReturnType<typeof this.getRules>>): WarningMatch[] {
    const matches: WarningMatch[] = [];
    const normalizedText = text.toLowerCase();

    for (const rule of rules) {
      const regex = new RegExp(rule.pattern, 'gi');
      const match = normalizedText.match(regex);
      if (match) {
        matches.push({
          category: rule.category,
          matchedText: match[0],
          severity: rule.severity,
          behavior: rule.behavior,
        });
      }
    }
    return matches;
  }

  async validateApplication(data: {
    jobTitle: string;
    company: string;
    location?: string;
    workArrangement?: string;
    jobDescription: string;
    profileId: string;
  }): Promise<{ warnings: WarningMatch[]; duplicates: unknown[] }> {
    const rules = await this.getRules();
    const scanFields = [
      data.jobTitle,
      data.location || '',
      data.workArrangement || '',
      data.jobDescription,
    ].join(' ');

    const warnings = this.scanText(scanFields, rules);

    const normalized = normalizeCompany(data.company);
    const duplicates = await this.prisma.application.findMany({
      where: {
        profileId: data.profileId,
        normalizedCompany: normalized,
      },
      select: {
        id: true,
        jobTitle: true,
        company: true,
        status: true,
        createdAt: true,
        bidder: { select: { firstName: true, lastName: true } },
      },
    });

    if (duplicates.length > 0) {
      warnings.push({
        category: WarningCategory.DUPLICATE,
        matchedText: `Duplicate application to ${data.company}`,
        severity: WarningSeverity.CONFIRM,
        behavior: WarningBehavior.CONFIRM,
      });
    }

    return { warnings, duplicates };
  }

  canGenerate(warnings: WarningMatch[]): { allowed: boolean; requiresConfirmation: boolean; requiresAdminReview: boolean } {
    const hasBlock = warnings.some((w) => w.behavior === WarningBehavior.BLOCK);
    const hasAdminReview = warnings.some((w) => w.behavior === WarningBehavior.ADMIN_REVIEW);
    const hasConfirm = warnings.some((w) => w.behavior === WarningBehavior.CONFIRM);

    return {
      allowed: !hasBlock && !hasAdminReview,
      requiresConfirmation: hasConfirm,
      requiresAdminReview: hasAdminReview,
    };
  }
}
