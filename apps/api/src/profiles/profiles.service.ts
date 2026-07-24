import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../common/types/auth.types';
import { isStaff } from '../common/utils/roles.util';

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: AuthUser) {
    if (isStaff(user.role)) {
      const profiles = await this.prisma.profile.findMany({
        where: { archivedAt: null },
        include: {
          _count: { select: { assignments: true, applications: true } },
          assignments: {
            where: { userId: user.id, activeTo: null },
            select: { isDefault: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return profiles.map(({ assignments, ...profile }) => ({
        ...profile,
        isDefault: assignments.some((a) => a.isDefault),
      }));
    }

    const assignments = await this.prisma.profileAssignment.findMany({
      where: { userId: user.id, activeTo: null },
      include: { profile: true },
    });
    return assignments
      .map((a) => ({
        ...a.profile,
        isDefault: a.isDefault,
      }))
      .filter((p) => !p.archivedAt);
  }

  async findOne(id: string, user: AuthUser) {
    await this.checkAccess(id, user);
    return this.prisma.profile.findUnique({
      where: { id },
      include: {
        experiences: { orderBy: { sortOrder: 'asc' } },
        education: { orderBy: { sortOrder: 'asc' } },
        skills: true,
        certifications: true,
        links: true,
      },
    });
  }

  async create(data: Record<string, unknown>) {
    const { experiences, education, skills, certifications, links, ...profileData } = data as {
      experiences?: unknown[];
      education?: unknown[];
      skills?: unknown[];
      certifications?: unknown[];
      links?: unknown[];
      [key: string]: unknown;
    };

    return this.prisma.profile.create({
      data: {
        ...(profileData as object),
        experiences: experiences ? { create: experiences as never[] } : undefined,
        education: education ? { create: education as never[] } : undefined,
        skills: skills ? { create: skills as never[] } : undefined,
        certifications: certifications ? { create: certifications as never[] } : undefined,
        links: links ? { create: links as never[] } : undefined,
      } as never,
      include: {
        experiences: true,
        education: true,
        skills: true,
        certifications: true,
        links: true,
      },
    });
  }

  async update(id: string, data: Record<string, unknown>) {
    const { experiences, education, skills, certifications, links, ...profileData } = data as {
      experiences?: unknown[];
      education?: unknown[];
      skills?: unknown[];
      certifications?: unknown[];
      links?: unknown[];
      [key: string]: unknown;
    };

    await this.prisma.profileExperience.deleteMany({ where: { profileId: id } });
    await this.prisma.profileEducation.deleteMany({ where: { profileId: id } });
    await this.prisma.profileSkill.deleteMany({ where: { profileId: id } });
    await this.prisma.profileCertification.deleteMany({ where: { profileId: id } });
    await this.prisma.profileLink.deleteMany({ where: { profileId: id } });

    return this.prisma.profile.update({
      where: { id },
      data: {
        ...(profileData as object),
        experiences: experiences ? { create: experiences as never[] } : undefined,
        education: education ? { create: education as never[] } : undefined,
        skills: skills ? { create: skills as never[] } : undefined,
        certifications: certifications ? { create: certifications as never[] } : undefined,
        links: links ? { create: links as never[] } : undefined,
      } as never,
      include: {
        experiences: true,
        education: true,
        skills: true,
        certifications: true,
        links: true,
      },
    });
  }

  async archive(id: string) {
    return this.prisma.profile.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async clone(id: string) {
    const original = await this.findOne(id, { id: '', email: '', role: UserRole.ADMIN, firstName: '', lastName: '' });
    if (!original) throw new NotFoundException('Profile not found');

    const { id: _id, createdAt, updatedAt, archivedAt, ...data } = original;
    return this.create({
      ...data,
      firstName: `${data.firstName} (Copy)`,
      experiences: original.experiences,
      education: original.education,
      skills: original.skills,
      certifications: original.certifications,
      links: original.links,
    });
  }

  async getAssignedProfiles(userId: string) {
    const assignments = await this.prisma.profileAssignment.findMany({
      where: { userId, activeTo: null },
      include: { profile: true },
    });
    return assignments;
  }

  async getDefaultProfile(userId: string) {
    const assignment = await this.prisma.profileAssignment.findFirst({
      where: { userId, isDefault: true, activeTo: null },
      include: { profile: true },
    });
    return assignment?.profile || null;
  }

  async setDefaultProfile(profileId: string, user: AuthUser) {
    await this.checkAccess(profileId, user);

    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, archivedAt: null },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    await this.prisma.profileAssignment.updateMany({
      where: { userId: user.id, activeTo: null },
      data: { isDefault: false },
    });

    const existing = await this.prisma.profileAssignment.findUnique({
      where: { userId_profileId: { userId: user.id, profileId } },
    });

    if (existing) {
      await this.prisma.profileAssignment.update({
        where: { id: existing.id },
        data: { isDefault: true, activeTo: null },
      });
    } else {
      await this.prisma.profileAssignment.create({
        data: { userId: user.id, profileId, isDefault: true },
      });
    }

    return { success: true, profileId, isDefault: true };
  }

  async checkAccess(profileId: string, user: AuthUser) {
    if (isStaff(user.role)) return;

    const assignment = await this.prisma.profileAssignment.findFirst({
      where: { userId: user.id, profileId, activeTo: null },
    });
    if (!assignment) throw new ForbiddenException('Profile not assigned to you');
  }

  buildProfileSnapshot(profile: NonNullable<Awaited<ReturnType<typeof this.findOne>>>) {
    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      profileTitle: profile.profileTitle,
      summary: profile.summary,
      workAuthorization: profile.workAuthorization,
      experiences: profile.experiences,
      education: profile.education,
      skills: profile.skills,
      certifications: profile.certifications,
      links: profile.links,
    };
  }
}
