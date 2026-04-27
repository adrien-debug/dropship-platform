'use client';

export function AdminLogoutButton() {
  const handleLogout = () => {
    document.cookie = 'admin_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    // Pas de page `/admin/login` dans le repo : retour à l’écran principal admin.
    window.location.href = '/admin/stores';
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left text-sm text-zinc-400 hover:text-white px-4 py-2 rounded hover:bg-zinc-900"
    >
      Déconnexion
    </button>
  );
}
