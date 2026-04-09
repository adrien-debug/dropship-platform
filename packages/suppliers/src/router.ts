import type { SupplierProduct, RouterProduct, SupplierSearchParams } from './interface';
import { CJDropshippingClient, getCJClient } from './cj';
import { AliExpressClient, getAliExpressClient } from './aliexpress';

function normalizeCJ(p: SupplierProduct): RouterProduct {
  const costEur = p.costCents / 100;
  return {
    id: `cj-${p.externalId}`,
    title: p.name,
    description: p.description,
    price: Math.round(costEur * 2.6 * 100) / 100,
    cost: costEur,
    image: p.imageUrls[0] ?? '',
    images: p.imageUrls,
    supplier: 'cjdropshipping',
    supplierProductId: p.externalId,
    category: p.category,
    variants: p.variants.map(v => ({ name: v.name, values: [v.sku] })),
  };
}

function normalizeAliExpress(p: SupplierProduct): RouterProduct {
  const costEur = p.costCents / 100;
  return {
    id: `ae-${p.externalId}`,
    title: p.name,
    description: p.description,
    price: Math.round(costEur * 2.6 * 100) / 100,
    cost: costEur,
    image: p.imageUrls[0] ?? '',
    images: p.imageUrls,
    supplier: 'aliexpress',
    supplierProductId: p.externalId,
    category: p.category,
    variants: p.variants.map(v => ({ name: v.name, values: [v.sku] })),
  };
}

export class SupplierRouter {
  constructor(
    private cj: CJDropshippingClient | null,
    private ae: AliExpressClient | null,
  ) {}

  async search(params: SupplierSearchParams): Promise<RouterProduct[]> {
    const { keywords, limit = 20, minPrice, maxPrice, preferredSuppliers } = params;
    const useAll = !preferredSuppliers || preferredSuppliers.length === 0 || preferredSuppliers.length === 2;
    const useCJ = useAll || preferredSuppliers!.includes('cjdropshipping');
    const useAE = useAll || preferredSuppliers!.includes('aliexpress');

    const searchOpts = { limit };

    const [cjResults, aeResults] = await Promise.all([
      useCJ && this.cj
        ? this.cj.searchProducts([keywords], searchOpts).catch(err => {
            console.error('[SupplierRouter] CJ search failed:', err instanceof Error ? err.message : err);
            return [] as SupplierProduct[];
          })
        : Promise.resolve([] as SupplierProduct[]),
      useAE && this.ae
        ? this.ae.searchProducts([keywords], searchOpts).catch(err => {
            console.error('[SupplierRouter] AliExpress search failed:', err instanceof Error ? err.message : err);
            return [] as SupplierProduct[];
          })
        : Promise.resolve([] as SupplierProduct[]),
    ]);

    let results: RouterProduct[] = [
      ...cjResults.map(normalizeCJ),
      ...aeResults.map(normalizeAliExpress),
    ];

    if (minPrice !== undefined) {
      results = results.filter(p => p.cost >= minPrice);
    }
    if (maxPrice !== undefined) {
      results = results.filter(p => p.cost <= maxPrice);
    }

    return results.slice(0, limit);
  }

  static fromEnv(): SupplierRouter {
    return new SupplierRouter(getCJClient(), getAliExpressClient());
  }
}
