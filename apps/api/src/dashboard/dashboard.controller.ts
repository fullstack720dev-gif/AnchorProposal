import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { DashboardService, DashboardMetricsFilters } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/types/auth.types';

function splitCsv(value?: string): string[] | undefined {
  if (!value?.trim()) return undefined;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('metrics')
  getMetrics(
    @Req() req: { user: AuthUser },
    @Query('adminIds') adminIds?: string,
    @Query('bidderIds') bidderIds?: string,
    @Query('statuses') statuses?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const statusList = splitCsv(statuses);
    const validStatuses = statusList?.filter((s) =>
      Object.values(ApplicationStatus).includes(s as ApplicationStatus),
    ) as ApplicationStatus[] | undefined;

    const filters: DashboardMetricsFilters = {
      adminIds: splitCsv(adminIds),
      bidderIds: splitCsv(bidderIds),
      statuses: validStatuses?.length ? validStatuses : undefined,
      startDate: startDate?.trim() || undefined,
      endDate: endDate?.trim() || undefined,
    };

    return this.dashboardService.getMetrics(req.user, filters);
  }
}
