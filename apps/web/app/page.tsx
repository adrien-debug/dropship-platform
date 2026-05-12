import { redirect } from 'next/navigation';

// Hearst Dropship runs as a portfolio of per-store storefronts at /shop/{slug}
// (or each store's own custom domain). The root path is reserved for the
// admin: visiting `/` lands operators on the portfolio dashboard.
//
// Real visitors only ever see /shop/<slug> URLs (or their store's custom
// domain rewritten transparently by the middleware), so this redirect is
// invisible to end customers.
export default function RootPage() {
  redirect('/admin');
}
