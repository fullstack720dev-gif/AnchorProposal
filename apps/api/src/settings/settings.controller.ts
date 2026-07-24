import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../common/types/auth.types';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  /** Master initial prompt list */
  @Get('prompts')
  @Roles(UserRole.MASTER)
  getPrompts() {
    return this.settingsService.getMasterPrompts();
  }

  @Post('prompts')
  @Roles(UserRole.MASTER)
  createPrompt(@Body('content') content: string) {
    return this.settingsService.createMasterPrompt(content);
  }

  @Post('prompts/:id/publish')
  @Roles(UserRole.MASTER)
  publishPrompt(@Param('id') id: string) {
    return this.settingsService.publishMasterPrompt(id);
  }

  @Patch('prompts/:id')
  @Roles(UserRole.MASTER)
  updatePrompt(@Param('id') id: string, @Body('content') content: string) {
    return this.settingsService.updateMasterPrompt(id, content);
  }

  @Delete('prompts/:id')
  @Roles(UserRole.MASTER)
  deletePrompt(@Param('id') id: string) {
    return this.settingsService.deleteMasterPrompt(id);
  }

  /** Effective / my prompt for Admin, Bidder (and Master for convenience) */
  @Get('my-prompt')
  getMyPrompt(@Req() req: { user: AuthUser }) {
    return this.settingsService.getMyPromptSettings(req.user);
  }

  @Patch('my-prompt')
  @Roles(UserRole.ADMIN)
  updateMyPrompt(
    @Body() body: { useMasterPrompt?: boolean; content?: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.settingsService.updateMyPromptSettings(req.user, body);
  }

  @Get('ai')
  @Roles(UserRole.MASTER)
  getAiSettings() {
    return this.settingsService.getAiSettings();
  }

  @Patch('ai')
  @Roles(UserRole.MASTER)
  updateAiSettings(@Body() body: { apiKey?: string; model?: string }) {
    return this.settingsService.updateAiSettings(body);
  }
}
