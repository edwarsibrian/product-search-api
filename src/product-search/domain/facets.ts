export interface FacetValue {
  value: string;
  count: number;
}

export interface PriceStats {
  min: number | null;
  max: number | null;
  avg: number | null;
}

export interface Facets {
  categories: FacetValue[];
  subcategories: FacetValue[];
  locations: FacetValue[];
  price: PriceStats;
}
