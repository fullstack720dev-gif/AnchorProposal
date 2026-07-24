import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, UserStatus } from '@prisma/client';
import { AuthUser } from '../common/types/auth.types';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll(@Req() req: { user: AuthUser }) {
    return this.usersService.findAll(req.user);
  }

  @Get('admins')
  listAdmins(@Req() req: { user: AuthUser }) {
    return this.usersService.listAdmins(req.user);
  }

  @Post()
  create(
    @Body()
    body: {
      email: string;
      password?: string;
      firstName: string;
      lastName: string;
      role?: UserRole;
      managedByAdminId?: string;
    },
    @Req() req: { user: AuthUser },
  ) {
    return this.usersService.create(body, req.user);
  }

  @Patch(':id/managed-by')
  updateManagedBy(
    @Param('id') id: string,
    @Body('managedByAdminId') managedByAdminId: string | null,
    @Req() req: { user: AuthUser },
  ) {
    return this.usersService.updateManagedBy(id, managedByAdminId, req.user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
    @Req() req: { user: AuthUser },
  ) {
    return this.usersService.updateStatus(id, status, req.user);
  }

  @Patch(':id/permissions')
  updatePermissions(
    @Param('id') id: string,
    @Body()
    perms: {
      canCreateApplications?: boolean;
      canGenerateResumes?: boolean;
      canDownloadDocuments?: boolean;
    },
    @Req() req: { user: AuthUser },
  ) {
    return this.usersService.updatePermissions(id, perms, req.user);
  }

  @Patch(':id/prompt-assignment')
  updatePromptAssignment(
    @Param('id') id: string,
    @Body() body: { useMasterPrompt: boolean; content?: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.usersService.updatePromptAssignment(
      id,
      { useMasterPrompt: Boolean(body.useMasterPrompt), content: body.content },
      req.user,
    );
  }

  @Patch(':id/assignments')
  updateAssignments(
    @Param('id') id: string,
    @Body('assignments') assignments: { profileId: string; isDefault?: boolean }[],
    @Req() req: { user: AuthUser },
  ) {
    return this.usersService.updateAssignments(id, assignments, req.user);
  }

  @Patch(':id/template-assignments')
  updateTemplateAssignments(
    @Param('id') id: string,
    @Body('assignments') assignments: { templateVersionId: string; isDefault?: boolean }[],
    @Req() req: { user: AuthUser },
  ) {
    return this.usersService.updateTemplateAssignments(id, assignments, req.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      resetPassword?: boolean;
    },
    @Req() req: { user: AuthUser },
  ) {
    return this.usersService.update(id, body, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.usersService.remove(id, req.user);
  }
}
