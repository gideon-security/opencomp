import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUrl,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Impact, Likelihood, VendorCategory, VendorStatus } from '@db';
import {
  OptionalAssigneeProperty,
  OptionalImpactProperty,
  OptionalLikelihoodProperty,
} from '../../common/dto/risk-vendor-fields';

export class CreateVendorDto {
  @ApiProperty({
    description: 'Vendor name',
    example: 'CloudTech Solutions Inc.',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Detailed description of the vendor and services provided',
    example:
      'Cloud infrastructure provider offering AWS-like services including compute, storage, and networking solutions for enterprise customers.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Vendor category',
    enum: VendorCategory,
    default: VendorCategory.other,
    example: VendorCategory.cloud,
  })
  @IsOptional()
  @IsEnum(VendorCategory)
  category?: VendorCategory;

  @ApiProperty({
    description: 'Assessment status of the vendor',
    enum: VendorStatus,
    default: VendorStatus.not_assessed,
    example: VendorStatus.not_assessed,
  })
  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;

  @OptionalLikelihoodProperty({
    description: 'Inherent probability of risk before controls',
    example: Likelihood.possible,
    defaultValue: Likelihood.very_unlikely,
  })
  inherentProbability?: Likelihood;

  @OptionalImpactProperty({
    description: 'Inherent impact of risk before controls',
    example: Impact.moderate,
    defaultValue: Impact.insignificant,
  })
  inherentImpact?: Impact;

  @OptionalLikelihoodProperty({
    description: 'Residual probability after controls are applied',
    example: Likelihood.unlikely,
    defaultValue: Likelihood.very_unlikely,
  })
  residualProbability?: Likelihood;

  @OptionalImpactProperty({
    description: 'Residual impact after controls are applied',
    example: Impact.minor,
    defaultValue: Impact.insignificant,
  })
  residualImpact?: Impact;

  @ApiProperty({
    description: 'Vendor website URL',
    required: false,
    example: 'https://www.cloudtechsolutions.com',
  })
  @IsOptional()
  @IsUrl()
  @Transform(({ value }) => (value === '' ? undefined : value))
  website?: string;

  @ApiProperty({
    description: 'Whether the vendor is a sub-processor',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isSubProcessor?: boolean;

  @OptionalAssigneeProperty('ID of the user assigned to manage this vendor')
  assigneeId?: string;
}
