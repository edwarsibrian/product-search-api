export interface AutocompleteResponseDto {
  query: string;
  suggestions: Array<{ text: string; productId: string }>;
  cached: boolean;
}
