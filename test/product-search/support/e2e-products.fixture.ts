import type { ProductDocument } from '../../../src/product-search/infrastructure/elasticsearch/product-index.mapping';

/**
 * Small, hand-authored, deterministic dataset for e2e tests — deliberately
 * separate from `data/products.json` so assertions here never depend on
 * (or break from) the real dataset being regenerated. 2 categories × 2
 * subcategories each (8 products) plus one extra "Laptop *" to round the
 * autocomplete cluster out to 3. Price, popularity, and created_at are
 * hand-picked into three independent rankings (verified by inspection, not
 * algorithmic permutation — the set is small enough) so a sort assertion
 * can never be explained by coincidence with another field's order.
 *
 * Rankings (desc):
 *   price:       dell-xps > samsung-s24 > lenovo-thinkpad > hp-pavilion >
 *                xiaomi-redmi > adidas-ultraboost > nike-airmax >
 *                bolso-cuero > cinturon
 *   popularity:  samsung-s24(95) > hp-pavilion(85) > bolso-cuero(70) >
 *                nike-airmax(60) > lenovo-thinkpad(55) > dell-xps(40) >
 *                xiaomi-redmi(20) > adidas-ultraboost(15) > cinturon(5)
 *   created_at:  bolso-cuero(2025-04-01) > xiaomi-redmi(2025-02-20) >
 *                nike-airmax(2024-09-05) > lenovo-thinkpad(2024-07-07) >
 *                hp-pavilion(2024-06-15) > cinturon(2024-03-12) >
 *                dell-xps(2024-01-10) > samsung-s24(2023-11-02) >
 *                adidas-ultraboost(2023-08-18)
 *
 * `q=laptop` matches exactly 3 products (dell-xps, hp-pavilion,
 * lenovo-thinkpad) — used both for a relevance-search assertion and, via
 * the typo `q=lapto`, for the did-you-mean assertion.
 */
export const E2E_PRODUCTS: ProductDocument[] = [
  {
    id: 'laptop-dell-xps-13',
    name: 'Laptop Dell XPS 13',
    description: 'Ultrabook de 13 pulgadas con pantalla InfinityEdge.',
    category: 'Electrónica',
    subcategories: ['Portátiles'],
    location: 'Madrid',
    price: 1249.0,
    popularity: 40,
    created_at: '2024-01-10T09:00:00.000Z',
  },
  {
    id: 'laptop-hp-pavilion-15',
    name: 'Laptop HP Pavilion 15',
    description: 'Portátil de 15 pulgadas para uso diario y oficina.',
    category: 'Electrónica',
    subcategories: ['Portátiles'],
    location: 'Barcelona',
    price: 699.99,
    popularity: 85,
    created_at: '2024-06-15T09:00:00.000Z',
  },
  {
    id: 'laptop-lenovo-thinkpad-e14',
    name: 'Laptop Lenovo ThinkPad E14',
    description: 'Portátil profesional de 14 pulgadas para programación.',
    category: 'Electrónica',
    subcategories: ['Portátiles'],
    location: 'Madrid',
    price: 799.0,
    popularity: 55,
    created_at: '2024-07-07T09:00:00.000Z',
  },
  {
    id: 'smartphone-samsung-galaxy-s24',
    name: 'Smartphone Samsung Galaxy S24',
    description: 'Smartphone Android de gama alta con cámara triple.',
    category: 'Electrónica',
    subcategories: ['Smartphones'],
    location: 'Madrid',
    price: 899.0,
    popularity: 95,
    created_at: '2023-11-02T09:00:00.000Z',
  },
  {
    id: 'smartphone-xiaomi-redmi-note-13',
    name: 'Smartphone Xiaomi Redmi Note 13',
    description: 'Smartphone económico con buena autonomía de batería.',
    category: 'Electrónica',
    subcategories: ['Smartphones'],
    location: 'Barcelona',
    price: 249.99,
    popularity: 20,
    created_at: '2025-02-20T09:00:00.000Z',
  },
  {
    id: 'zapatillas-nike-air-max',
    name: 'Zapatillas Nike Air Max',
    description: 'Zapatillas deportivas con amortiguación de aire.',
    category: 'Moda',
    subcategories: ['Calzado'],
    location: 'Madrid',
    price: 129.99,
    popularity: 60,
    created_at: '2024-09-05T09:00:00.000Z',
  },
  {
    id: 'zapatillas-adidas-ultraboost',
    name: 'Zapatillas Adidas Ultraboost',
    description: 'Zapatillas de running con suela responsiva.',
    category: 'Moda',
    subcategories: ['Calzado'],
    location: 'Barcelona',
    price: 159.99,
    popularity: 15,
    created_at: '2023-08-18T09:00:00.000Z',
  },
  {
    id: 'bolso-cuero-artesanal',
    name: 'Bolso de Cuero Artesanal',
    description: 'Bolso de mano hecho a mano en cuero genuino.',
    category: 'Moda',
    subcategories: ['Accesorios'],
    location: 'Madrid',
    price: 89.5,
    popularity: 70,
    created_at: '2025-04-01T09:00:00.000Z',
  },
  {
    id: 'cinturon-piel-clasico',
    name: 'Cinturón de Piel Clásico',
    description: 'Cinturón de piel genuina con hebilla metálica.',
    category: 'Moda',
    subcategories: ['Accesorios'],
    location: 'Barcelona',
    price: 29.99,
    popularity: 5,
    created_at: '2024-03-12T09:00:00.000Z',
  },
];
