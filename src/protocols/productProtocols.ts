export type CreateProductData = {
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  subscriberDiscount?: number;
  imageUrl?: string | null;
  stock?: number;
  active?: boolean;
};

export type UpdateProductData = Partial<CreateProductData>;

export type ListProductsQuery = {
  active?: boolean;
  category?: string;
  q?: string;
};
