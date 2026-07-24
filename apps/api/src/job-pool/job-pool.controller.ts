import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('job-pool')
@UseGuards(JwtAuthGuard)
export class JobPoolController {
  @Get()
  findAll() {
    return {
      enabled: false,
      message: 'Job Pool integration coming soon',
      jobs: [],
      total: 0,
    };
  }
}
