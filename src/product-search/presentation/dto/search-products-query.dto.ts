import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { toStringArray } from '../transforms/to-string-array.transform';
import type {
  SortField,
  SortOrder,
} from '../../domain/value-objects/sort-criteria.vo';

function toTrimmedString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function toOptionalNumber({ value }: { value: unknown }): unknown {
  return value === undefined || value === '' ? value : Number(value);
}

export class SearchProductsQueryDto {
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(toStringArray)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  category: string[] = [];

  @IsOptional()
  @Transform(toStringArray)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  subcategory: string[] = [];

  @IsOptional()
  @Transform(toStringArray)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  location: string[] = [];

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['relevance', 'popularity', 'createdAt'])
  sort: SortField = 'relevance';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: SortOrder = 'desc';

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
