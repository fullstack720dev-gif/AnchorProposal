import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { GenerationsService } from './generations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/types/auth.types';

@Controller()
@UseGuards(JwtAuthGuard)
export class GenerationsController {
  constructor(private generationsService: GenerationsService) {}

  @Post('applications/:id/generations')
  startGeneration(
    @Param('id') id: string,
    @Body() body: { templateId?: string; idempotencyKey?: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.generationsService.startGeneration(id, req.user, body.templateId, body.idempotencyKey);
  }

  @Get('applications/:id/generations')
  listByApplication(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.generationsService.findByApplication(id, req.user);
  }

  @Get('generations/:id')
  findOne(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.generationsService.findOne(id, req.user);
  }
}
