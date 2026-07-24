import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import { AuthUser } from '../common/types/auth.types';
import {
  canManageUserStatus,
  isMaster,
  isStaff,
  isAdmin,
  isOwnedBidder,
} from '../common/utils/roles.util';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(actor: AuthUser) {
    if (!isStaff(actor.role)) throw new ForbiddenException();

    const where =
      actor.role === UserRole.MASTER
        ? { role: { in: [UserRole.ADMIN, UserRole.BIDDER] } }
        : { role: UserRole.BIDDER, managedByAdminId: actor.id };

    const users = await this.prisma.user.findMany({
      where,
      include: {
        managedByAdmin: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        profileAssignments: {
          include: {
            profile: {
              select: { id: true, firstName: true, lastName: true, profileTitle: true },
            },
          },
        },
        templateAssignments: {
          include: {
            templateVersion: {
              select: { id: true, name: true, isPublished: true, archivedAt: true },
            },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });

    const bidderIds = users.filter((u) => u.role === UserRole.BIDDER).map((u) => u.id);
    const contentByBidder = new Map<string, string>();
    if (bidderIds.length > 0) {
      const prompts = await this.prisma.promptVersion.findMany({
        where: { ownerId: { in: bidderIds }, isPublished: true },
        orderBy: { publishedAt: 'desc' },
        select: { ownerId: true, content: true },
      });
      for (const p of prompts) {
        if (p.ownerId && !contentByBidder.has(p.ownerId)) {
          contentByBidder.set(p.ownerId, p.content);
        }
      }
    }

    return users.map((u) => ({
      ...u,
      assignedPromptContent:
        u.role === UserRole.BIDDER ? contentByBidder.get(u.id) ?? null : null,
    }));
  }

  async listAdmins(actor: AuthUser) {
    if (!isMaster(actor.role)) throw new ForbiddenException();
    return this.prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: { id: true, firstName: true, lastName: true, email: true, status: true },
      orderBy: { firstName: 'asc' },
    });
  }

  private static readonly DEFAULT_PASSWORD = '123456';

  async create(
    data: {
      email: string;
      password?: string;
      firstName: string;
      lastName: string;
      role?: UserRole;
      managedByAdminId?: string;
    },
    actor: AuthUser,
  ) {
    if (!isStaff(actor.role)) throw new ForbiddenException();

    const role = data.role || UserRole.BIDDER;
    if (role === UserRole.MASTER) {
      throw new ForbiddenException('Cannot create another Master account');
    }
    if (role === UserRole.ADMIN && !isMaster(actor.role)) {
      throw new ForbiddenException('Only Master can create Admin accounts');
    }
    if (isAdmin(actor.role) && role !== UserRole.BIDDER) {
      throw new ForbiddenException('Admins can only create bidder accounts');
    }

    let managedByAdminId: string | null = null;
    if (role === UserRole.BIDDER) {
      if (isAdmin(actor.role)) {
        managedByAdminId = actor.id;
      } else if (isMaster(actor.role)) {
        if (!data.managedByAdminId) {
          throw new BadRequestException('managedByAdminId is required when Master creates a bidder');
        }
        const admin = await this.prisma.user.findUnique({ where: { id: data.managedByAdminId } });
        if (!admin || admin.role !== UserRole.ADMIN) {
          throw new BadRequestException('managedByAdminId must be an Admin user');
        }
        managedByAdminId = admin.id;
      }
    }

    const existing = await this.prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already exists');

    const password = data.password?.trim() || UsersService.DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role,
        status: UserStatus.ACTIVE,
        managedByAdminId,
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        action: 'USER_CREATED',
        targetType: 'User',
        targetId: user.id,
        changesJson: { email: user.email, role: user.role, managedByAdminId },
      },
    });

    return user;
  }

  async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      resetPassword?: boolean;
    },
    actor: AuthUser,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (
      !canManageUserStatus(actor.role, user.role, {
        actorId: actor.id,
        managedByAdminId: user.managedByAdminId,
      })
    ) {
      throw new ForbiddenException('You cannot update this account');
    }

    if (data.email) {
      const email = data.email.toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already exists');
      }
    }

    const passwordHash = data.resetPassword
      ? await bcrypt.hash(UsersService.DEFAULT_PASSWORD, 10)
      : undefined;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.email !== undefined ? { email: data.email.toLowerCase() } : {}),
        ...(passwordHash
          ? { passwordHash, refreshToken: null }
          : {}),
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        action: 'USER_UPDATED',
        targetType: 'User',
        targetId: id,
        changesJson: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          resetPassword: !!data.resetPassword,
        },
      },
    });

    return updated;
  }

  async remove(id: string, actor: AuthUser) {
    if (id === actor.id) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.MASTER) {
      throw new ForbiddenException('Cannot delete Master account');
    }

    if (
      !canManageUserStatus(actor.role, user.role, {
        actorId: actor.id,
        managedByAdminId: user.managedByAdminId,
      })
    ) {
      throw new ForbiddenException('You cannot delete this account');
    }

    const [appCount, noteCount, historyCount, genCount] = await Promise.all([
      this.prisma.application.count({ where: { bidderId: id } }),
      this.prisma.applicationNote.count({ where: { authorId: id } }),
      this.prisma.applicationStatusHistory.count({ where: { actorId: id } }),
      this.prisma.resumeGeneration.count({ where: { creatorId: id } }),
    ]);
    if (appCount + noteCount + historyCount + genCount > 0) {
      throw new BadRequestException(
        'Cannot delete user with application history. Suspend the account instead.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (user.role === UserRole.ADMIN) {
        await tx.user.updateMany({
          where: { managedByAdminId: id },
          data: { managedByAdminId: null },
        });
      }
      await tx.auditEvent.updateMany({
        where: { actorId: id },
        data: { actorId: null },
      });
      await tx.user.update({
        where: { id },
        data: { refreshToken: null },
      });
      await tx.user.delete({ where: { id } });
    });

    await this.prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        action: 'USER_DELETED',
        targetType: 'User',
        targetId: id,
        changesJson: { email: user.email, role: user.role },
      },
    });

    return { ok: true };
  }

  async updateManagedBy(id: string, managedByAdminId: string | null, actor: AuthUser) {
    if (!isMaster(actor.role)) throw new ForbiddenException('Only Master can reassign bidder ownership');

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.BIDDER) {
      throw new BadRequestException('Only bidders can be assigned to an admin');
    }

    if (managedByAdminId) {
      const admin = await this.prisma.user.findUnique({ where: { id: managedByAdminId } });
      if (!admin || admin.role !== UserRole.ADMIN) {
        throw new BadRequestException('managedByAdminId must be an Admin user');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: { managedByAdminId },
    });
  }

  async updateStatus(id: string, status: UserStatus, actor: AuthUser) {
    const allowed: UserStatus[] = [UserStatus.ACTIVE, UserStatus.PENDING, UserStatus.SUSPENDED];
    if (!allowed.includes(status)) {
      throw new BadRequestException('Status must be ACTIVE, PENDING, or SUSPENDED');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (
      !canManageUserStatus(actor.role, user.role, {
        actorId: actor.id,
        managedByAdminId: user.managedByAdminId,
      })
    ) {
      throw new ForbiddenException('You cannot change status for this account');
    }

    const revokeSession = status === UserStatus.SUSPENDED || status === UserStatus.PENDING;
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status,
        ...(revokeSession ? { refreshToken: null } : {}),
      },
    });

    const action =
      status === UserStatus.ACTIVE
        ? 'USER_ALLOWED'
        : status === UserStatus.PENDING
          ? 'USER_DISALLOWED'
          : 'USER_SUSPENDED';

    await this.prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        action,
        targetType: 'User',
        targetId: user.id,
        reason: `${actor.role} set status to ${status}`,
        changesJson: { from: user.status, to: status },
      },
    });

    return updated;
  }

  async updatePermissions(
    id: string,
    perms: {
      canCreateApplications?: boolean;
      canGenerateResumes?: boolean;
      canDownloadDocuments?: boolean;
    },
    actor: AuthUser,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.BIDDER) {
      throw new ForbiddenException('Only bidders have these permissions toggles');
    }
    if (
      !canManageUserStatus(actor.role, user.role, {
        actorId: actor.id,
        managedByAdminId: user.managedByAdminId,
      })
    ) {
      throw new ForbiddenException();
    }
    return this.prisma.user.update({ where: { id }, data: perms });
  }

  async updatePromptAssignment(
    id: string,
    data: { useMasterPrompt: boolean; content?: string },
    actor: AuthUser,
  ) {
    if (!isAdmin(actor.role)) {
      throw new ForbiddenException('Only admins can assign prompts to bidders');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.BIDDER) {
      throw new ForbiddenException('Prompt assignment is only available for bidders');
    }
    if (
      !canManageUserStatus(actor.role, user.role, {
        actorId: actor.id,
        managedByAdminId: user.managedByAdminId,
      })
    ) {
      throw new ForbiddenException();
    }

    const useMasterPrompt = Boolean(data.useMasterPrompt);
    let assignedPromptContent: string | null = null;

    if (!useMasterPrompt) {
      const content = data.content?.trim() ?? '';
      if (!content) {
        throw new BadRequestException('Custom prompt content is required');
      }

      const existing = await this.prisma.promptVersion.findFirst({
        where: { isPublished: true, ownerId: id },
        orderBy: { publishedAt: 'desc' },
      });
      if (existing) {
        await this.prisma.promptVersion.update({
          where: { id: existing.id },
          data: { content },
        });
      } else {
        const latest = await this.prisma.promptVersion.findFirst({
          where: { ownerId: id },
          orderBy: { version: 'desc' },
        });
        await this.prisma.promptVersion.updateMany({
          where: { ownerId: id },
          data: { isPublished: false },
        });
        await this.prisma.promptVersion.create({
          data: {
            content,
            version: (latest?.version || 0) + 1,
            ownerId: id,
            isPublished: true,
            publishedAt: new Date(),
          },
        });
      }
      assignedPromptContent = content;
    } else {
      const existing = await this.prisma.promptVersion.findFirst({
        where: { isPublished: true, ownerId: id },
        orderBy: { publishedAt: 'desc' },
        select: { content: true },
      });
      assignedPromptContent = existing?.content ?? null;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { useMasterPrompt },
      include: {
        managedByAdmin: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        profileAssignments: {
          include: {
            profile: {
              select: { id: true, firstName: true, lastName: true, profileTitle: true },
            },
          },
        },
        templateAssignments: {
          include: {
            templateVersion: {
              select: { id: true, name: true, isPublished: true, archivedAt: true },
            },
          },
        },
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        action: 'BIDDER_PROMPT_ASSIGNMENT_UPDATED',
        targetType: 'User',
        targetId: id,
        changesJson: {
          useMasterPrompt,
          contentUpdated: !useMasterPrompt,
        },
      },
    });

    return { ...updated, assignedPromptContent };
  }

  async updateAssignments(
    userId: string,
    assignments: { profileId: string; isDefault?: boolean }[],
    actor: AuthUser,
  ) {
    if (!isStaff(actor.role)) throw new ForbiddenException();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.BIDDER) {
      throw new ForbiddenException('Profiles can only be assigned to bidders');
    }
    if (isAdmin(actor.role) && !isOwnedBidder(actor.id, user)) {
      throw new ForbiddenException('You can only assign profiles to your own bidders');
    }

    await this.prisma.profileAssignment.deleteMany({ where: { userId } });

    if (assignments.length > 0) {
      const hasDefault = assignments.some((a) => a.isDefault);
      await this.prisma.profileAssignment.createMany({
        data: assignments.map((a, i) => ({
          userId,
          profileId: a.profileId,
          isDefault: a.isDefault ?? (!hasDefault && i === 0),
        })),
      });
    }

    await this.prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        action: 'PROFILE_ASSIGNMENTS_UPDATED',
        targetType: 'User',
        targetId: userId,
        changesJson: { assignments },
      },
    });

    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profileAssignments: { include: { profile: true } },
      },
    });
  }

  async updateTemplateAssignments(
    userId: string,
    assignments: { templateVersionId: string; isDefault?: boolean }[],
    actor: AuthUser,
  ) {
    if (!isStaff(actor.role)) throw new ForbiddenException();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.BIDDER) {
      throw new ForbiddenException('Templates can only be assigned to bidders');
    }
    if (isAdmin(actor.role) && !isOwnedBidder(actor.id, user)) {
      throw new ForbiddenException('You can only assign templates to your own bidders');
    }

    if (assignments.length > 0) {
      const ids = assignments.map((a) => a.templateVersionId);
      const templates = await this.prisma.templateVersion.findMany({
        where: { id: { in: ids } },
        select: { id: true, isPublished: true, archivedAt: true },
      });
      if (templates.length !== ids.length) {
        throw new BadRequestException('One or more templates were not found');
      }
      const invalid = templates.find((t) => !t.isPublished || t.archivedAt);
      if (invalid) {
        throw new BadRequestException('Only published, non-archived templates can be assigned');
      }
    }

    await this.prisma.templateAssignment.deleteMany({ where: { userId } });

    if (assignments.length > 0) {
      const hasDefault = assignments.some((a) => a.isDefault);
      await this.prisma.templateAssignment.createMany({
        data: assignments.map((a, i) => ({
          userId,
          templateVersionId: a.templateVersionId,
          isDefault: a.isDefault ?? (!hasDefault && i === 0),
        })),
      });
    }

    await this.prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        action: 'TEMPLATE_ASSIGNMENTS_UPDATED',
        targetType: 'User',
        targetId: userId,
        changesJson: { assignments },
      },
    });

    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        templateAssignments: {
          include: {
            templateVersion: {
              select: { id: true, name: true, isPublished: true, archivedAt: true },
            },
          },
        },
      },
    });
  }

  /** Bidder IDs owned by an admin (for scoping). */
  async ownedBidderIds(adminId: string): Promise<string[]> {
    const bidders = await this.prisma.user.findMany({
      where: { role: UserRole.BIDDER, managedByAdminId: adminId },
      select: { id: true },
    });
    return bidders.map((b) => b.id);
  }
}
