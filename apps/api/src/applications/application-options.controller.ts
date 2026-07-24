import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApplicationOptionType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/types/auth.types';
import { ApplicationOptionsService } from './application-options.service';

@Controller('application-options')
@UseGuards(JwtAuthGuard)
export class ApplicationOptionsController {
  constructor(private optionsService: ApplicationOptionsService) {}

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.optionsService.list(req.user);
  }

  @Post()
  create(
    @Body() body: { type: ApplicationOptionType; value: string; isDefault?: boolean },
    @Req() req: { user: AuthUser },
  ) {
    return this.optionsService.create(req.user, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { value?: string; isDefault?: boolean },
    @Req() req: { user: AuthUser },
  ) {
    return this.optionsService.update(id, req.user, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.optionsService.remove(id, req.user);
  }
}
