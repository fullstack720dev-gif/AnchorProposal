import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ApplicationOptionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth.types';
import { canBid } from '../common/utils/roles.util';

const DEFAULTS: Record<ApplicationOptionType, string> = {
  LOCATION: 'US',
  SOURCE: 'Builtin',
};

function normalizeValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

@Injectable()
export class ApplicationOptionsService {
  constructor(private prisma: PrismaService) {}

  private assertCanManage(user: AuthUser) {
    if (!canBid(user.role)) {
      throw new ForbiddenException('Only Admin and Bidder accounts can manage application options');
    }
  }

  private async ensureDefaults(userId: string) {
    for (const type of [ApplicationOptionType.LOCATION, ApplicationOptionType.SOURCE]) {
      const count = await this.prisma.applicationOption.count({ where: { userId, type } });
      if (count === 0) {
        await this.prisma.applicationOption.create({
          data: {
            userId,
            type,
            value: DEFAULTS[type],
            normalizedValue: normalizeValue(DEFAULTS[type]),
            isDefault: true,
            sortOrder: 0,
          },
        });
      }
    }
  }

  async list(user: AuthUser) {
    this.assertCanManage(user);
    await this.ensureDefaults(user.id);

    const options = await this.prisma.applicationOption.findMany({
      where: { userId: user.id },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { value: 'asc' }],
    });

    return {
      locations: options.filter((o) => o.type === ApplicationOptionType.LOCATION),
      sources: options.filter((o) => o.type === ApplicationOptionType.SOURCE),
    };
  }

  async create(user: AuthUser, data: { type: ApplicationOptionType; value: string; isDefault?: boolean }) {
    this.assertCanManage(user);
    await this.ensureDefaults(user.id);

    const value = (data.value || '').trim();
    if (!value) throw new BadRequestException('Value is required');
    if (value.length > 100) throw new BadRequestException('Value must be 100 characters or fewer');

    const normalizedValue = normalizeValue(value);
    const existing = await this.prisma.applicationOption.findUnique({
      where: {
        userId_type_normalizedValue: {
          userId: user.id,
          type: data.type,
          normalizedValue,
        },
      },
    });
    if (existing) throw new ConflictException('That option already exists');

    const maxSort = await this.prisma.applicationOption.aggregate({
      where: { userId: user.id, type: data.type },
      _max: { sortOrder: true },
    });

    const makeDefault = data.isDefault === true;
    const created = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.applicationOption.updateMany({
          where: { userId: user.id, type: data.type, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.applicationOption.create({
        data: {
          userId: user.id,
          type: data.type,
          value,
          normalizedValue,
          isDefault: makeDefault,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
      });
    });

    await this.prisma.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'APPLICATION_OPTION_CREATED',
        targetType: 'ApplicationOption',
        targetId: created.id,
        changesJson: { type: data.type, value },
      },
    });

    return created;
  }

  async update(
    id: string,
    user: AuthUser,
    data: { value?: string; isDefault?: boolean },
  ) {
    this.assertCanManage(user);
    const option = await this.prisma.applicationOption.findFirst({
      where: { id, userId: user.id },
    });
    if (!option) throw new NotFoundException('Option not found');

    let value = option.value;
    let normalizedValue = option.normalizedValue;

    if (data.value !== undefined) {
      value = data.value.trim();
      if (!value) throw new BadRequestException('Value is required');
      if (value.length > 100) throw new BadRequestException('Value must be 100 characters or fewer');
      normalizedValue = normalizeValue(value);
      const clash = await this.prisma.applicationOption.findFirst({
        where: {
          userId: user.id,
          type: option.type,
          normalizedValue,
          NOT: { id },
        },
      });
      if (clash) throw new ConflictException('That option already exists');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.applicationOption.updateMany({
          where: { userId: user.id, type: option.type, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.applicationOption.update({
        where: { id },
        data: {
          value,
          normalizedValue,
          ...(data.isDefault === true ? { isDefault: true } : {}),
          ...(data.isDefault === false && option.isDefault
            ? { isDefault: false }
            : {}),
        },
      });
    });

    // If we cleared the only default, promote first remaining
    if (data.isDefault === false) {
      const hasDefault = await this.prisma.applicationOption.findFirst({
        where: { userId: user.id, type: option.type, isDefault: true },
      });
      if (!hasDefault) {
        const first = await this.prisma.applicationOption.findFirst({
          where: { userId: user.id, type: option.type },
          orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
        });
        if (first) {
          await this.prisma.applicationOption.update({
            where: { id: first.id },
            data: { isDefault: true },
          });
        }
      }
    }

    await this.prisma.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'APPLICATION_OPTION_UPDATED',
        targetType: 'ApplicationOption',
        targetId: id,
        changesJson: data,
      },
    });

    return this.prisma.applicationOption.findUnique({ where: { id } });
  }

  async remove(id: string, user: AuthUser) {
    this.assertCanManage(user);
    const option = await this.prisma.applicationOption.findFirst({
      where: { id, userId: user.id },
    });
    if (!option) throw new NotFoundException('Option not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.applicationOption.delete({ where: { id } });
      if (option.isDefault) {
        const next = await tx.applicationOption.findFirst({
          where: { userId: user.id, type: option.type },
          orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
        });
        if (next) {
          await tx.applicationOption.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });

    await this.prisma.auditEvent.create({
      data: {
        actorId: user.id,
        action: 'APPLICATION_OPTION_DELETED',
        targetType: 'ApplicationOption',
        targetId: id,
        changesJson: { type: option.type, value: option.value },
      },
    });

    return { ok: true };
  }
}
