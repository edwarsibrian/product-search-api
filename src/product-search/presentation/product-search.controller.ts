import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseFilters,
} from '@nestjs/common';
import { SearchProductsQueryDto } from './dto/search-products-query.dto';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { AutocompleteResponseDto } from './dto/autocomplete-response.dto';
import { SearchProductsUseCase } from '../application/search-products.usecase';
import { AutocompleteProductsUseCase } from '../application/autocomplete-products.usecase';
import { toSearchCriteria } from './mappers/search-criteria.mapper';
import { toSearchResponseDto } from './mappers/search-response.mapper';
import { ProductSearchExceptionFilter } from './filters/product-search-exception.filter';

@Controller('api/v1/products')
@UseFilters(ProductSearchExceptionFilter)
export class ProductSearchController {
  constructor(
    private readonly searchProductsUseCase: SearchProductsUseCase,
    private readonly autocompleteProductsUseCase: AutocompleteProductsUseCase,
  ) {}

  @Get('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Query() query: SearchProductsQueryDto,
  ): Promise<SearchResponseDto> {
    const criteria = toSearchCriteria(query);
    const result = await this.searchProductsUseCase.execute(criteria);
    return toSearchResponseDto(result, criteria);
  }

  @Get('autocomplete')
  @HttpCode(HttpStatus.OK)
  async autocomplete(
    @Query() query: AutocompleteQueryDto,
  ): Promise<AutocompleteResponseDto> {
    const { suggestions, cached } =
      await this.autocompleteProductsUseCase.execute(query.q, query.limit);
    return { query: query.q, suggestions, cached };
  }
}
