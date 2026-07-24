import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { RulesService } from './rules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('settings/warning-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RulesController {
  constructor(private rulesService: RulesService) {}

  /** Staff can view; Master owns mutations */
  @Get()
  @Roles(UserRole.ADMIN)
  getRules() {
    return this.rulesService.getRules();
  }

  @Post()
  @Roles(UserRole.MASTER)
  createRule(@Body() body: { category: string; pattern: string; severity: string; behavior: string }) {
    return this.rulesService.createRule(body as Parameters<RulesService['createRule']>[0]);
  }

  @Patch(':id')
  @Roles(UserRole.MASTER)
  updateRule(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.rulesService.updateRule(id, body as Parameters<RulesService['updateRule']>[1]);
  }
}
