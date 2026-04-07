import { task, logger } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import { CJDropshippingClient } from '@dropship/suppliers';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const orderFulfill = task({
  id: 'order-fulfill',
  maxDuration: 60,
  run: async (payload: {
    orderId: string;
    supplier: string;
    externalProductId: string;
    quantity: number;
    shippingAddress: {
      name: string;
      address: string;
      city: string;
      country: string;
      zip: string;
      phone: string;
    };
  }) => {
    logger.info('Fulfilling order', { orderId: payload.orderId, supplier: payload.supplier });

    if (payload.supplier === 'cjdropshipping') {
      const cjKey = process.env.CJ_DROPSHIPPING_API_KEY;
      if (!cjKey) throw new Error('CJ API key not configured');

      const client = new CJDropshippingClient({ apiKey: cjKey });

      const result = await client.createOrder({
        orderNumber: payload.orderId,
        shippingAddress: payload.shippingAddress,
        products: [{ vid: payload.externalProductId, quantity: payload.quantity }],
      });

      await supabase.from('orders').update({
        supplier_order_id: result.orderId,
        fulfillment_status: result.status,
        fulfilled_at: new Date().toISOString(),
      }).eq('id', payload.orderId);

      logger.info('CJ order placed', {
        orderId: payload.orderId,
        supplierOrderId: result.orderId,
      });

      return {
        status: result.status,
        supplier: 'cjdropshipping',
        supplierOrderId: result.orderId,
      };
    }

    throw new Error(`Unsupported supplier: ${payload.supplier}`);
  },
});
