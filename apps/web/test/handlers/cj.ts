import { http, HttpResponse } from 'msw';

/**
 * CJ Dropshipping mock.
 *
 * The founder hasn't obtained the real API key yet, so CJ always returns an
 * auth-error in prod. We mirror that exactly: `authenticate()` raises and
 * `searchProducts()` short-circuits to `{ success: false }`. This is the
 * intended default — tests that need CJ data must override with their own
 * handler.
 */

export const cjHandlers = [
  http.post(
    'https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken',
    () => {
      return HttpResponse.json(
        {
          code: 1600200,
          result: false,
          message: 'Email or password is incorrect.',
        },
        { status: 200 },
      );
    },
  ),
  http.post(
    'https://developers.cjdropshipping.com/api2.0/v1/product/list',
    () => {
      // Should be unreachable when auth fails first, but defensive coverage in
      // case a future code path skips authenticate().
      return HttpResponse.json(
        { code: 1600200, result: false, message: 'Unauthorized' },
        { status: 401 },
      );
    },
  ),
];
