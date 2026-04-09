'use client';

export default function ContactPage() {
  return (
    <div className="bg-gray-950 min-h-screen text-white">
      <section className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="mb-4 text-4xl font-bold">Contact TestLuxury</h1>
        <p className="mb-8 opacity-70">Questions? We'd love to hear from you.</p>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <input type="text" placeholder="Name" className="w-full rounded-lg border bg-transparent px-4 py-3 text-sm" />
          <input type="email" placeholder="Email" className="w-full rounded-lg border bg-transparent px-4 py-3 text-sm" />
          <textarea placeholder="Message" rows={5} className="w-full rounded-lg border bg-transparent px-4 py-3 text-sm" />
          <button type="submit" className="rounded-lg bg-white px-6 py-3 text-sm font-bold text-gray-900 transition hover:bg-gray-200">
            Send Message
          </button>
        </form>
      </section>
    </div>
  );
}