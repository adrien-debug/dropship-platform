import { redirect } from 'next/navigation';

/** Évite un 404 sur `/admin` : une seule section admin est implémentée pour l’instant. */
export default function AdminIndexPage() {
  redirect('/admin/medusa');
}
