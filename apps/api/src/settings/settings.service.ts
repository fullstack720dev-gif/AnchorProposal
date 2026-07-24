import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth.types';
import { isAdmin, isMaster } from '../common/utils/roles.util';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  /** Master-owned published initial prompt (ownerId null). */
  async getMasterPublishedPrompt() {
    return this.prisma.promptVersion.findFirst({
      where: { isPublished: true, ownerId: null },
      orderBy: { publishedAt: 'desc' },
    });
  }

  /** @deprecated Prefer resolvePromptForUser — kept for callers expecting global publish. */
  async getPublishedPrompt() {
    return this.getMasterPublishedPrompt();
  }

  async getMasterPrompts() {
    return this.prisma.promptVersion.findMany({
      where: { ownerId: null },
      orderBy: { version: 'desc' },
    });
  }

  async createMasterPrompt(content: string) {
    if (!content?.trim()) throw new BadRequestException('Prompt content is required');
    const latest = await this.prisma.promptVersion.findFirst({
      where: { ownerId: null },
      orderBy: { version: 'desc' },
    });
    return this.prisma.promptVersion.create({
      data: {
        content: content.trim(),
        version: (latest?.version || 0) + 1,
        ownerId: null,
      },
    });
  }

  async publishMasterPrompt(id: string) {
    const prompt = await this.prisma.promptVersion.findUnique({ where: { id } });
    if (!prompt || prompt.ownerId !== null) {
      throw new NotFoundException('Master prompt not found');
    }
    await this.prisma.promptVersion.updateMany({
      where: { ownerId: null },
      data: { isPublished: false },
    });
    return this.prisma.promptVersion.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
    });
  }

  async updateMasterPrompt(id: string, content: string) {
    if (!content?.trim()) throw new BadRequestException('Prompt content is required');
    const prompt = await this.prisma.promptVersion.findUnique({ where: { id } });
    if (!prompt || prompt.ownerId !== null) {
      throw new NotFoundException('Master prompt not found');
    }
    return this.prisma.promptVersion.update({
      where: { id },
      data: { content: content.trim() },
    });
  }

  async deleteMasterPrompt(id: string) {
    const prompt = await this.prisma.promptVersion.findUnique({ where: { id } });
    if (!prompt || prompt.ownerId !== null) {
      throw new NotFoundException('Master prompt not found');
    }
    await this.prisma.promptVersion.delete({ where: { id } });
    return { success: true, id };
  }

  private async getAdminPublishedPrompt(adminId: string) {
    return this.prisma.promptVersion.findFirst({
      where: { isPublished: true, ownerId: adminId },
      orderBy: { publishedAt: 'desc' },
    });
  }

  private async getBidderPublishedPrompt(bidderId: string) {
    return this.prisma.promptVersion.findFirst({
      where: { isPublished: true, ownerId: bidderId },
      orderBy: { publishedAt: 'desc' },
    });
  }

  /**
   * Resolve the prompt used for generations for this user.
   * Bidders use Initial (Master) or their own assigned custom PromptVersion.
   */
  async resolvePromptForUser(
    user: AuthUser | { id: string; role: string },
  ): Promise<{ id: string; content: string; version: number; isPublished: boolean }> {
    if (isMaster(user.role)) {
      const prompt = await this.getMasterPublishedPrompt();
      if (!prompt) throw new BadRequestException('No published initial prompt');
      return prompt;
    }

    if (isAdmin(user.role)) {
      const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser) throw new NotFoundException('User not found');
      if (dbUser.useMasterPrompt) {
        const prompt = await this.getMasterPublishedPrompt();
        if (!prompt) throw new BadRequestException('No published initial prompt');
        return prompt;
      }
      const custom = await this.getAdminPublishedPrompt(user.id);
      if (!custom) {
        throw new BadRequestException(
          'You selected a custom prompt but have not saved one yet. Save your prompt in Settings.',
        );
      }
      return custom;
    }

    // Bidder — per-bidder assignment (useMasterPrompt on bidder row)
    const bidder = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!bidder?.managedByAdminId) {
      throw new BadRequestException('Bidder is not assigned to an admin; cannot resolve prompt');
    }

    if (bidder.useMasterPrompt !== false) {
      const prompt = await this.getMasterPublishedPrompt();
      if (!prompt) throw new BadRequestException('No published initial prompt');
      return prompt;
    }

    const custom = await this.getBidderPublishedPrompt(bidder.id);
    if (!custom) {
      throw new BadRequestException(
        'No custom prompt assigned yet. Ask your Admin to assign a custom prompt, or switch to the Initial prompt.',
      );
    }
    return custom;
  }

  async getMyPromptSettings(user: AuthUser) {
    const masterPrompt = await this.getMasterPublishedPrompt();

    if (isMaster(user.role)) {
      return {
        role: 'MASTER' as const,
        useMasterPrompt: true,
        promptSource: 'initial' as const,
        masterPrompt,
        myPrompt: null,
        effectivePrompt: masterPrompt,
      };
    }

    if (isAdmin(user.role)) {
      const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
      const myPrompt = await this.getAdminPublishedPrompt(user.id);
      const useMasterPrompt = dbUser?.useMasterPrompt ?? true;
      let effectivePrompt = masterPrompt;
      if (!useMasterPrompt && myPrompt) effectivePrompt = myPrompt;
      else if (!useMasterPrompt && !myPrompt) effectivePrompt = null;
      return {
        role: 'ADMIN' as const,
        useMasterPrompt,
        promptSource: (useMasterPrompt ? 'initial' : 'custom') as 'initial' | 'custom',
        masterPrompt,
        myPrompt,
        effectivePrompt,
      };
    }

    // Bidder
    const bidder = await this.prisma.user.findUnique({ where: { id: user.id } });
    const useMasterPrompt = bidder?.useMasterPrompt !== false;
    const effectivePrompt = await this.resolvePromptForUser(user).catch(() => null);
    const bidderCustom = !useMasterPrompt
      ? await this.getBidderPublishedPrompt(user.id)
      : null;

    return {
      role: 'BIDDER' as const,
      useMasterPrompt,
      promptSource: (useMasterPrompt ? 'initial' : 'custom') as 'initial' | 'custom',
      masterPrompt: useMasterPrompt ? masterPrompt : null,
      myPrompt: bidderCustom,
      effectivePrompt,
    };
  }

  async updateMyPromptSettings(
    user: AuthUser,
    data: { useMasterPrompt?: boolean; content?: string },
  ) {
    if (!isAdmin(user.role)) {
      throw new ForbiddenException('Only admins can update their prompt settings');
    }

    if (data.useMasterPrompt !== undefined) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { useMasterPrompt: data.useMasterPrompt },
      });
    }

    if (data.content !== undefined) {
      const content = data.content.trim();
      if (!content) throw new BadRequestException('Prompt content is required');

      const existing = await this.getAdminPublishedPrompt(user.id);
      if (existing) {
        await this.prisma.promptVersion.update({
          where: { id: existing.id },
          data: { content },
        });
      } else {
        const latest = await this.prisma.promptVersion.findFirst({
          where: { ownerId: user.id },
          orderBy: { version: 'desc' },
        });
        await this.prisma.promptVersion.updateMany({
          where: { ownerId: user.id },
          data: { isPublished: false },
        });
        await this.prisma.promptVersion.create({
          data: {
            content,
            version: (latest?.version || 0) + 1,
            ownerId: user.id,
            isPublished: true,
            publishedAt: new Date(),
          },
        });
      }
    }

    return this.getMyPromptSettings(user);
  }

  async getAiSettings() {
    const key = await this.prisma.systemSetting.findUnique({ where: { key: 'deepseek_api_key' } });
    const model = await this.prisma.systemSetting.findUnique({ where: { key: 'deepseek_model' } });
    return {
      hasApiKey: !!key?.value,
      model: model?.value || 'deepseek-chat',
    };
  }

  async updateAiSettings(data: { apiKey?: string; model?: string }) {
    if (data.apiKey) {
      await this.prisma.systemSetting.upsert({
        where: { key: 'deepseek_api_key' },
        create: { key: 'deepseek_api_key', value: data.apiKey },
        update: { value: data.apiKey },
      });
    }
    if (data.model) {
      await this.prisma.systemSetting.upsert({
        where: { key: 'deepseek_model' },
        create: { key: 'deepseek_model', value: data.model },
        update: { value: data.model },
      });
    }
    return this.getAiSettings();
  }

  async getApiKey(): Promise<string | null> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'deepseek_api_key' } });
    return setting?.value || process.env.DEEPSEEK_API_KEY || null;
  }

  async getModel(): Promise<string> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'deepseek_model' } });
    return setting?.value || 'deepseek-chat';
  }
}
