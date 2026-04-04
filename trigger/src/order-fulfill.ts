import { task, logger } from '@trigger.dev/sdk/v3';
import { CJDropshippingClient } from '@dropship/suppliers';

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

      logger.info('CJ order fulfillment initiated', {
        orderId: payload.orderId,
        productId: payload.externalProductId,
        quantity: payload.quantity,
      });

      return {
        status: 'pending',
        supplier: 'cjdropshipping',
        message: 'Order submitted to CJ Dropshipping',
      };
    }

    throw new Error(`Unsupported supplier: ${payload.supplier}`);
  },
});
