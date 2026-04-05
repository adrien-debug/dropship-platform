export type ProductSort = 'price_asc' | 'price_desc' | 'new' | 'popular' | 'random';

export interface ProductDto {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  inStock: boolean;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  items: ProductDto[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductDetailResponse {
  product: ProductDto;
}

export type StockFilter = 'all' | 'in_stock' | 'out_of_stock';

export type LayoutMode = 'grid' | 'list';
