import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { BackgroundCheckBillingController } from './background-check-billing.controller';
import { BackgroundCheckBillingService } from './background-check-billing.service';
import { BackgroundCheckCustomService } from './background-check-custom.service';
import { CheckrClient } from './checkr.client';
import { BackgroundCheckIdentityClient } from './background-check-identity.client';
import { BackgroundCheckPaymentService } from './background-check-payment.service';
import {
  BackgroundChecksController,
  PeopleBackgroundChecksController,
} from './background-checks.controller';
import { BackgroundChecksService } from './background-checks.service';

@Module({
  imports: [AuthModule, AttachmentsModule, BillingModule],
  controllers: [
    BackgroundChecksController,
    PeopleBackgroundChecksController,
    BackgroundCheckBillingController,
  ],
  providers: [
    BackgroundChecksService,
    BackgroundCheckBillingService,
    BackgroundCheckCustomService,
    CheckrClient,
    // Legacy alias for the same client. Single shared instance so both
    // injection tokens resolve to one CheckrClient.
    {
      provide: BackgroundCheckIdentityClient,
      useExisting: CheckrClient,
    },
    BackgroundCheckPaymentService,
  ],
  exports: [BackgroundChecksService, BackgroundCheckBillingService],
})
export class BackgroundChecksModule {}
