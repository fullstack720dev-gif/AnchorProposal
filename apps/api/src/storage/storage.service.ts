import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService {
  private basePath: string;

  constructor(config: ConfigService) {
    this.basePath = config.get('STORAGE_PATH') || './storage';
  }

  async ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
  }

  getResumeDir(applicationId: string, generationId: string) {
    return path.join(this.basePath, 'resumes', applicationId, generationId);
  }

  async saveFile(applicationId: string, generationId: string, filename: string, content: Buffer | string) {
    const dir = this.getResumeDir(applicationId, generationId);
    await this.ensureDir(dir);
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, content);
    return filePath;
  }

  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // ignore missing files
    }
  }

  async deleteResumeTree(applicationId: string): Promise<void> {
    const dir = path.join(this.basePath, 'resumes', applicationId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
