import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AutocompleteQueryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  q!: string;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === '' ? value : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 10;
}
