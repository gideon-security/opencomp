import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GideonDevicesProxyController } from './gideon-devices.controller';

@Module({
  imports: [AuthModule],
  controllers: [GideonDevicesProxyController],
})
export class GideonModule {}
