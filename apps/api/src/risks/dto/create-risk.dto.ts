import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import {
  RiskCategory,
  Departments,
  RiskStatus,
  Likelihood,
  Impact,
  RiskTreatmentType,
} from '@db';
import { DEPARTMENT_MAX_LENGTH } from '../../policies/dto/create-policy.dto';
import {
  OptionalAssigneeProperty,
  OptionalImpactProperty,
  OptionalLikelihoodProperty,
} from '../../common/dto/risk-vendor-fields';

export class CreateRiskDto {
  @ApiProperty({
    description: 'Risk title',
    example: 'Data breach vulnerability in user authentication system',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Detailed description of the risk',
    example:
      'Weak password requirements could lead to unauthorized access to user accounts',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Risk category',
    enum: RiskCategory,
    example: RiskCategory.technology,
  })
  @IsEnum(RiskCategory)
  category: RiskCategory;

  @ApiProperty({
    description:
      'Department responsible for the risk. Built-in values: none, admin, gov, hr, it, itsm, qms. Custom department names are also accepted.',
    required: false,
    example: Departments.it,
    type: 'string',
    maxLength: DEPARTMENT_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(DEPARTMENT_MAX_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  department?: string;

  @ApiProperty({
    description: 'Current status of the risk',
    enum: RiskStatus,
    default: RiskStatus.open,
    example: RiskStatus.open,
  })
  @IsOptional()
  @IsEnum(RiskStatus)
  status?: RiskStatus;

  @OptionalLikelihoodProperty({
    description: 'Likelihood of the risk occurring',
    example: Likelihood.possible,
    defaultValue: Likelihood.very_unlikely,
  })
  likelihood?: Likelihood;

  @OptionalImpactProperty({
    description: 'Impact if the risk materializes',
    example: Impact.major,
    defaultValue: Impact.insignificant,
  })
  impact?: Impact;

  @OptionalLikelihoodProperty({
    description: 'Residual likelihood after treatment',
    example: Likelihood.unlikely,
    defaultValue: Likelihood.very_unlikely,
  })
  residualLikelihood?: Likelihood;

  @OptionalImpactProperty({
    description: 'Residual impact after treatment',
    example: Impact.minor,
    defaultValue: Impact.insignificant,
  })
  residualImpact?: Impact;

  @ApiProperty({
    description: 'Description of the treatment strategy',
    required: false,
    example:
      'Implement multi-factor authentication and strengthen password requirements',
  })
  @IsOptional()
  @IsString()
  treatmentStrategyDescription?: string;

  @ApiProperty({
    description: 'Risk treatment strategy',
    enum: RiskTreatmentType,
    default: RiskTreatmentType.accept,
    example: RiskTreatmentType.mitigate,
  })
  @IsOptional()
  @IsEnum(RiskTreatmentType)
  treatmentStrategy?: RiskTreatmentType;

  @OptionalAssigneeProperty('ID of the user assigned to this risk')
  assigneeId?: string;
}
