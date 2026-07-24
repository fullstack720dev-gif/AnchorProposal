import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [DocumentsController],
  providers: [StorageService],
})
export class DocumentsModule {}
