import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ImageGallery } from '@/components/shop/image-gallery';
import { ProductBuyBox } from '@/components/shop/product-buy-box';
import { ProductInfo } from '@/components/shop/product-info';
import { ProductTabs } from '@/components/shop/product-tabs';
import { RelatedProducts } from '@/components/shop/related-products';
import { ShopBreadcrumb } from '@/components/shop/shop-breadcrumb';
import { fetchProductById, fetchRelatedProducts } from '@/lib/product-api';

const idSchema = z.string().uuid();

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { title: 'Product · One Peace Shop' };
  }
  const result = await fetchProductById(parsed.data);
  if (!result.ok) {
    return { title: 'Product · One Peace Shop' };
  }
  return {
    title: `${result.product.name} · One Peace Shop`,
    description: result.product.description.slice(0, 160) || undefined,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    notFound();
  }

  const result = await fetchProductById(parsed.data);
  if (!result.ok) {
    if (result.status === 404) {
      notFound();
    }
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-[var(--dashboard-error)]">{result.message}</p>
        <p className="mt-2 text-[var(--dashboard-text-muted)]">
          The catalog API may require authentication. Sign in on the main app (same browser) and reload
          this page.
        </p>
      </main>
    );
  }

  const product = result.product;
  const related = await fetchRelatedProducts(product.category, product.id, 4);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <ShopBreadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Shop', href: '/shop' },
          { label: product.name },
        ]}
      />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <ImageGallery alt={product.name} imageUrls={product.imageUrls} />
        <div className="flex flex-col gap-8">
          <ProductInfo product={product} />
          <ProductBuyBox product={product} />
          <ProductTabs description={product.description} />
        </div>
      </div>
      <RelatedProducts products={related} />
    </main>
  );
}
