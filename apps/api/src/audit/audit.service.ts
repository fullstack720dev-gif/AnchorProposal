import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { action?: string; targetType?: string; limit?: number }) {
    return this.prisma.auditEvent.findMany({
      where: {
        ...(filters?.action ? { action: filters.action } : {}),
        ...(filters?.targetType ? { targetType: filters.targetType } : {}),
      },
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
    });
  }

  async log(data: {
    actorId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    changesJson?: object;
    reason?: string;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditEvent.create({ data });
  }
}
