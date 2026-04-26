import Link from "next/link";
import { AdminLogoutButton } from "../login/AdminLogoutButton";

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/stores", label: "Boutiques", badge: "Multi" },
    { href: "/admin/boutique", label: "Boutique" },
    { href: "/admin/produits", label: "Produits" },
    { href: "/admin/suppliers", label: "Fournisseurs", badge: "Ali+CJ" },
    { href: "/admin/medusa", label: "Medusa", badge: "Railway" },
    { href: "/admin/agents-managed", label: "Agents IA", highlight: true },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-black text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold">Dropship Admin</h1>
        </div>
        <nav className="flex-1 px-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-4 py-2 rounded transition-colors ${
                    item.highlight
                      ? "bg-blue-600 hover:bg-blue-700 font-semibold"
                      : "hover:bg-gray-800"
                  }`}
                >
                  {item.highlight && <span className="mr-2">✨</span>}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <AdminLogoutButton />
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-white p-8">{children}</main>
    </div>
  );
}
