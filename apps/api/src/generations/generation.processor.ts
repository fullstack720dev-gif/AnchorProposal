import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GenerationsService } from './generations.service';
import { DeepseekService } from '../deepseek/deepseek.service';
import { DocumentRendererService } from '../documents/document-renderer.service';
import { GenerationStatus } from '@prisma/client';
import type { GenerationOutput } from '@anchorproposal/shared';

@Processor('resume-generation')
export class GenerationProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private generationsService: GenerationsService,
    private deepseek: DeepseekService,
    private renderer: DocumentRendererService,
  ) {
    super();
  }

  async process(job: Job<{ generationId: string; applicationId: string }>) {
    const { generationId, applicationId } = job.data;

    try {
      await this.generationsService.updateStatus(generationId, GenerationStatus.VALIDATING);

      const generation = await this.prisma.resumeGeneration.findUnique({
        where: { id: generationId },
        include: { promptVersion: true, templateVersion: true, application: true },
      });
      if (!generation) throw new Error('Generation not found');
      if (!generation.promptVersion?.content) {
        throw new Error('No published prompt version available');
      }

      const prompt = this.deepseek.buildPrompt(generation.promptVersion.content, {
        profileJson: JSON.stringify(generation.profileSnapshotJson),
        jobTitle: generation.application.jobTitle,
        company: generation.application.company,
        jobDescription: generation.application.jobDescription,
      });

      await this.generationsService.updateStatus(generationId, GenerationStatus.GENERATING);
      const profileSnap = generation.profileSnapshotJson as {
        firstName?: string;
        lastName?: string;
        profileTitle?: string | null;
        experiences?: Record<string, unknown>[];
      };
      const candidateName =
        `${profileSnap.firstName || ''} ${profileSnap.lastName || ''}`.trim() || undefined;
      const { content, tokenUsage } = await this.deepseek.generate(prompt, {
        jobTitle: generation.application.jobTitle,
        company: generation.application.company,
        candidateName,
        profileTitle: profileSnap.profileTitle || undefined,
        profileExperiences: Array.isArray(profileSnap.experiences)
          ? profileSnap.experiences
          : undefined,
      });
      const output = content as GenerationOutput;

      await this.generationsService.updateStatus(generationId, GenerationStatus.RENDERING, {
        structuredOutputJson: output,
        tokenUsage,
        costEstimate: tokenUsage * 0.00001,
      });

      const profile = generation.profileSnapshotJson as { firstName?: string; lastName?: string };
      const baseFilename =
        `${profile.firstName}_${profile.lastName}_${generation.application.company}_${generation.application.jobTitle}`
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .substring(0, 100) + `_v${generation.version}`;

      const templateConfig = (generation.templateVersion?.configJson || {}) as object;

      const files = await this.renderer.renderAll(
        applicationId,
        generationId,
        {
          contact: output.contact,
          summary: output.summary,
          skills: output.skills,
          experiences: output.experiences,
          educations: output.educations,
          certificates: output.certificates,
        },
        templateConfig,
        baseFilename,
      );

      const cover = output.coverLetter || {
        greeting: 'Dear Hiring Manager,',
        paragraphs: [
          `I am writing to express my interest in the ${generation.application.jobTitle} role at ${generation.application.company}.`,
        ],
        closing: 'Sincerely,',
        signatureName: candidateName || output.contact.name || 'Applicant',
      };

      const signatureName =
        cover.signatureName ||
        output.contact.name ||
        candidateName ||
        'Applicant';

      const coverFiles = await this.renderer.renderCoverLetter(
        applicationId,
        generationId,
        {
          greeting: cover.greeting,
          paragraphs: cover.paragraphs,
          closing: cover.closing,
          signatureName,
          company: generation.application.company,
        },
        baseFilename,
        templateConfig,
      );

      await this.generationsService.updateStatus(generationId, GenerationStatus.UPLOADING);

      await this.prisma.generationFile.createMany({
        data: [...files, ...coverFiles].map((f) => ({
          generationId,
          type: f.type,
          kind: f.kind,
          filename: f.filename,
          storagePath: f.storagePath,
          version: generation.version,
        })),
      });

      await this.generationsService.updateStatus(generationId, GenerationStatus.COMPLETED, {
        structuredOutputJson: output,
        tokenUsage,
      });

      await this.prisma.auditEvent.create({
        data: {
          action: 'RESUME_GENERATED',
          targetType: 'ResumeGeneration',
          targetId: generationId,
          actorId: generation.creatorId,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.generationsService.updateStatus(generationId, GenerationStatus.FAILED, {
        errorMessage: message,
      });
      throw error;
    }
  }
}
