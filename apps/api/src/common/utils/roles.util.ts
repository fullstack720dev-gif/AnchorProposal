import { UserRole } from '@prisma/client';

export function isMaster(role: string): boolean {
  return role === UserRole.MASTER;
}

export function isAdmin(role: string): boolean {
  return role === UserRole.ADMIN;
}

export function isStaff(role: string): boolean {
  return role === UserRole.MASTER || role === UserRole.ADMIN;
}

/** Roles that may create applications and generate documents. */
export function canBid(role: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.BIDDER;
}

export function canManageUserStatus(
  actorRole: string,
  targetRole: string,
  opts?: { actorId?: string; managedByAdminId?: string | null },
): boolean {
  if (targetRole === UserRole.MASTER) return false;
  if (actorRole === UserRole.MASTER) return true;
  if (actorRole === UserRole.ADMIN && targetRole === UserRole.BIDDER) {
    if (!opts?.actorId) return false;
    return opts.managedByAdminId === opts.actorId;
  }
  return false;
}

export function isOwnedBidder(
  adminId: string,
  bidder: { role: string; managedByAdminId?: string | null },
): boolean {
  return bidder.role === UserRole.BIDDER && bidder.managedByAdminId === adminId;
}
