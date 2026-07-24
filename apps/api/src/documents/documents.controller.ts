import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../common/types/auth.types';
import { isAdmin, isMaster } from '../common/utils/roles.util';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  @Get(':fileId/download')
  async download(
    @Param('fileId') fileId: string,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const file = await this.prisma.generationFile.findUnique({
      where: { id: fileId },
      include: {
        generation: {
          include: { application: true, creator: true },
        },
      },
    });
    if (!file) throw new NotFoundException('File not found');

    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!isMaster(req.user.role) && (!user || !user.canDownloadDocuments)) {
      throw new ForbiddenException('You do not have permission to download documents');
    }

    const app = file.generation.application;
    if (!isMaster(req.user.role)) {
      if (isAdmin(req.user.role)) {
        const ok =
          app.bidderId === req.user.id ||
          (
            await this.prisma.user.findUnique({ where: { id: app.bidderId } })
          )?.managedByAdminId === req.user.id;
        if (!ok) throw new ForbiddenException('Access denied');
      } else if (app.bidderId !== req.user.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    const exists = await this.storage.fileExists(file.storagePath);
    if (!exists) throw new NotFoundException('File not found on disk');

    const content = await this.storage.readFile(file.storagePath);
    const mimeTypes: Record<string, string> = {
      PDF: 'application/pdf',
      DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      TXT: 'text/plain',
    };

    res.setHeader('Content-Type', mimeTypes[file.type] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(content);
  }
}
