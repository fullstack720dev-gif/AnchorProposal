import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationOptionsService } from './application-options.service';
import { ApplicationOptionsController } from './application-options.controller';
import { ProfilesModule } from '../profiles/profiles.module';
import { RulesModule } from '../rules/rules.module';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [ProfilesModule, RulesModule],
  controllers: [ApplicationsController, ApplicationOptionsController],
  providers: [ApplicationsService, ApplicationOptionsService, StorageService],
  exports: [ApplicationsService, ApplicationOptionsService],
})
export class ApplicationsModule {}
