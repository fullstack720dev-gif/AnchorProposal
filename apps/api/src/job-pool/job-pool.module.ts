import { Module } from '@nestjs/common';
import { JobPoolController } from './job-pool.controller';

@Module({
  controllers: [JobPoolController],
})
export class JobPoolModule {}
