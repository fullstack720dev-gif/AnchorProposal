import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs/promises';
import * as path from 'path';
import { STARTER_WARNING_RULES } from '@anchorproposal/shared';

const prisma = new PrismaClient();

const STORAGE_PATH = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
const SEED_PROFILE_EMAIL = 'alexandra.chen@email.com';

async function removeDemoData() {
  const oldDemoApps = await prisma.application.findMany({
    where: { company: { startsWith: 'Demo Co' } },
    select: { id: true },
  });
  for (const old of oldDemoApps) {
    try {
      await fs.rm(path.join(STORAGE_PATH, 'resumes', old.id), { recursive: true, force: true });
    } catch {
      // ignore missing storage
    }
  }
  await prisma.application.deleteMany({ where: { company: { startsWith: 'Demo Co' } } });

  const seedProfile = await prisma.profile.findFirst({ where: { email: SEED_PROFILE_EMAIL } });
  if (seedProfile) {
    const profileApps = await prisma.application.findMany({
      where: { profileId: seedProfile.id },
      select: { id: true },
    });
    for (const app of profileApps) {
      try {
        await fs.rm(path.join(STORAGE_PATH, 'resumes', app.id), { recursive: true, force: true });
      } catch {
        // ignore missing storage
      }
    }
    await prisma.application.deleteMany({ where: { profileId: seedProfile.id } });
    await prisma.profileAssignment.deleteMany({ where: { profileId: seedProfile.id } });
    await prisma.profile.delete({ where: { id: seedProfile.id } });
  }
}

async function main() {
  await removeDemoData();

  const masterPassword = process.env.MASTER_PASSWORD || 'Master@12345';
  const masterHash = await bcrypt.hash(masterPassword, 10);
  const adminHash = await bcrypt.hash('admin123', 10);
  const bidderHash = await bcrypt.hash('bidder123', 10);

  const master = await prisma.user.upsert({
    where: { email: 'master@anchorproposal.com' },
    update: {
      username: 'Master',
      role: UserRole.MASTER,
      status: 'ACTIVE',
      passwordHash: masterHash,
    },
    create: {
      email: 'master@anchorproposal.com',
      username: 'Master',
      passwordHash: masterHash,
      firstName: 'Master',
      lastName: 'Account',
      role: UserRole.MASTER,
      status: 'ACTIVE',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@anchorproposal.com' },
    update: {},
    create: {
      email: 'admin@anchorproposal.com',
      passwordHash: adminHash,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      status: 'ACTIVE',
    },
  });

  const bidder = await prisma.user.upsert({
    where: { email: 'bidder@anchorproposal.com' },
    update: {
      managedByAdminId: admin.id,
      status: 'ACTIVE',
    },
    create: {
      email: 'bidder@anchorproposal.com',
      passwordHash: bidderHash,
      firstName: 'Eva',
      lastName: 'Martinez',
      role: UserRole.BIDDER,
      status: 'ACTIVE',
      managedByAdminId: admin.id,
    },
  });

  for (const rule of STARTER_WARNING_RULES) {
    const existing = await prisma.warningRule.findFirst({
      where: { category: rule.category as 'REMOTE_CONFLICT', pattern: rule.pattern },
    });
    if (!existing) {
      await prisma.warningRule.create({
        data: {
          category: rule.category as 'REMOTE_CONFLICT',
          pattern: rule.pattern,
          severity: rule.severity as 'CONFIRM',
          behavior: rule.behavior as 'CONFIRM',
        },
      });
    }
  }

  const defaultConfig = {
    typography: {
      bodyFont: 'Inter',
      headingFont: 'Inter',
      baseFontSize: 11,
      headingScale: 1.2,
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    layout: {
      pageSize: 'LETTER' as const,
      marginTop: 36,
      marginBottom: 36,
      marginLeft: 48,
      marginRight: 48,
      sectionSpacing: 16,
      headerAlignment: 'left' as const,
    },
    colors: {
      primary: '#1e3a5f',
      heading: '#1e293b',
      body: '#334155',
      accent: '#3b82f6',
      divider: '#e2e8f0',
    },
    sections: {
      order: ['summary', 'skills', 'experience', 'education', 'certifications'],
      visibility: {
        summary: true,
        skills: true,
        experience: true,
        education: true,
        certifications: true,
      },
    },
  };

  const templates = [
    {
      name: 'Modern Minimal',
      preset: 'modern-minimal',
      configJson: defaultConfig,
    },
    {
      name: 'Classic Professional',
      preset: 'classic-professional',
      configJson: {
        ...defaultConfig,
        typography: {
          ...defaultConfig.typography,
          bodyFont: 'Georgia',
          headingFont: 'Georgia',
          headingScale: 1.15,
          lineHeight: 1.5,
        },
        colors: {
          primary: '#2c3e50',
          heading: '#2c3e50',
          body: '#444444',
          accent: '#2c3e50',
          divider: '#cccccc',
        },
      },
    },
  ];

  for (const t of templates) {
    const exists = await prisma.templateVersion.findFirst({ where: { name: t.name } });
    if (!exists) {
      await prisma.templateVersion.create({
        data: { ...t, isPublished: true, publishedAt: new Date() },
      });
    }
  }

  console.log('Seed completed (baseline only):', {
    master: `${master.username} / ${masterPassword}`,
    admin: admin.email,
    bidder: bidder.email,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
