import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Impact, Likelihood } from '@db';

/**
 * Canonical Likelihood/Impact decorator factories.
 * Single-sources the `@ApiProperty` + `class-validator` stack that was
 * duplicated between `CreateRiskDto` and `CreateVendorDto`
 * (and their Update variants).
 *
 * Field names differ (likelihood vs inherentProbability) but the
 * enum + validation is identical — use the factory per-field with a
 * description appropriate to the resource.
 */

export function OptionalLikelihoodProperty(opts: {
  description: string;
  example: Likelihood;
  defaultValue?: Likelihood;
}): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      description: opts.description,
      enum: Likelihood,
      required: false,
      example: opts.example,
      ...(opts.defaultValue !== undefined ? { default: opts.defaultValue } : {}),
    }),
    IsOptional(),
    IsEnum(Likelihood),
  );
}

export function OptionalImpactProperty(opts: {
  description: string;
  example: Impact;
  defaultValue?: Impact;
}): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      description: opts.description,
      enum: Impact,
      required: false,
      example: opts.example,
      ...(opts.defaultValue !== undefined ? { default: opts.defaultValue } : {}),
    }),
    IsOptional(),
    IsEnum(Impact),
  );
}

export function OptionalLikelihoodPropertyOptional(opts: {
  description: string;
  enumName?: string;
}): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      description: opts.description,
      enum: Likelihood,
    }),
    IsOptional(),
    IsEnum(Likelihood),
  );
}

export function OptionalImpactPropertyOptional(opts: {
  description: string;
}): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ description: opts.description, enum: Impact }),
    IsOptional(),
    IsEnum(Impact),
  );
}

export function OptionalAssigneeProperty(description = 'ID of the user assigned to this resource'): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ description, required: false, example: 'mem_abc123def456' }),
    IsOptional(),
    IsString(),
  );
}

export function OptionalAssigneePropertyOptional(description = 'Assignee member ID'): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ description }),
    IsOptional(),
    IsString(),
  );
}
