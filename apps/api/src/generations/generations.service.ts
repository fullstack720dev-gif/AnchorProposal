import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import { RulesService } from '../rules/rules.service';
import { SettingsService } from '../settings/settings.service';
import { TemplatesService } from '../templates/templates.service';
import { GenerationStatus, UserRole } from '@prisma/client';
import { AuthUser } from '../common/types/auth.types';
import { canBid, isAdmin, isMaster } from '../common/utils/roles.util';

@Injectable()
export class GenerationsService {
  constructor(
    private prisma: PrismaService,
    private profilesService: ProfilesService,
    private rulesService: RulesService,
    private settingsService: SettingsService,
    private templatesService: TemplatesService,
    @InjectQueue('resume-generation') private queue: Queue,
  ) {}

  private async assertAppAccess(application: { bidderId: string; profileId: string }, user: AuthUser) {
    await this.profilesService.checkAccess(application.profileId, user);
    if (isMaster(user.role)) return;
    if (isAdmin(user.role)) {
      if (application.bidderId === user.id) return;
      const bidder = await this.prisma.user.findUnique({ where: { id: application.bidderId } });
      if (bidder?.managedByAdminId === user.id) return;
      throw new ForbiddenException('Access denied');
    }
    if (application.bidderId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
  }

  async startGeneration(
    applicationId: string,
    user: AuthUser,
    templateId?: string,
    idempotencyKey?: string,
  ) {
    if (!canBid(user.role)) {
      throw new ForbiddenException('Master accounts cannot generate resumes');
    }

    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.canGenerateResumes) {
      throw new ForbiddenException('You do not have permission to generate resumes');
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { warnings: true, profile: true },
    });
    if (!application) throw new NotFoundException('Application not found');

    await this.assertAppAccess(application, user);

    const genCheck = this.rulesService.canGenerate(
      application.warnings.map((w) => ({
        category: w.category,
        matchedText: w.matchedText,
        severity: w.severity,
        behavior: w.behavior,
      })),
    );
    if (!genCheck.allowed) {
      throw new BadRequestException('Generation blocked due to policy warnings');
    }

    if (idempotencyKey) {
      const existing = await this.prisma.resumeGeneration.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }

    const latestGen = await this.prisma.resumeGeneration.findFirst({
      where: { applicationId },
      orderBy: { version: 'desc' },
    });
    const version = (latestGen?.version || 0) + 1;

    const prompt = await this.settingsService.resolvePromptForUser(user);
    if (!prompt) throw new BadRequestException('No published prompt version');

    let templateVersionId = templateId;
    if (!templateVersionId) {
      templateVersionId = await this.templatesService.resolveDefaultTemplateId(user);
      if (!templateVersionId) {
        throw new BadRequestException(
          user.role === UserRole.BIDDER
            ? 'No template assigned. Ask your Admin to assign a template.'
            : 'No published template available',
        );
      }
    } else {
      await this.templatesService.checkAccess(templateVersionId, user);
      if (user.role === UserRole.BIDDER) {
        const tpl = await this.prisma.templateVersion.findUnique({ where: { id: templateVersionId } });
        if (!tpl?.isPublished) {
          throw new BadRequestException('Bidders may only use published templates');
        }
      }
    }

    const profile = await this.profilesService.findOne(application.profileId, user);
    const profileSnapshot = this.profilesService.buildProfileSnapshot(profile!);

    const generation = await this.prisma.resumeGeneration.create({
      data: {
        applicationId,
        creatorId: user.id,
        status: GenerationStatus.QUEUED,
        version,
        promptVersionId: prompt.id,
        templateVersionId,
        profileSnapshotJson: profileSnapshot,
        idempotencyKey,
      },
    });

    await this.queue.add('generate', {
      generationId: generation.id,
      applicationId,
      userId: user.id,
    });

    return generation;
  }

  async findByApplication(applicationId: string, user: AuthUser) {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) throw new NotFoundException('Application not found');
    await this.assertAppAccess(application, user);

    return this.prisma.resumeGeneration.findMany({
      where: { applicationId },
      include: { files: true, promptVersion: true, templateVersion: true },
      orderBy: { version: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const gen = await this.prisma.resumeGeneration.findUnique({
      where: { id },
      include: { files: true, application: true, promptVersion: true, templateVersion: true },
    });
    if (!gen) throw new NotFoundException('Generation not found');
    await this.assertAppAccess(gen.application, user);
    return gen;
  }

  async updateStatus(
    id: string,
    status: GenerationStatus,
    data?: Partial<{
      structuredOutputJson: object;
      tokenUsage: number;
      costEstimate: number;
      errorMessage: string;
    }>,
  ) {
    return this.prisma.resumeGeneration.update({
      where: { id },
      data: {
        status,
        ...data,
        ...(status === GenerationStatus.COMPLETED ? { completedAt: new Date() } : {}),
      },
    });
  }
}
