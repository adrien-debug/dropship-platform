export default function AboutPage() {
  return (
    <div className="bg-gray-950 min-h-screen text-white">
      <section className="mx-auto max-w-4xl px-6 py-24">
        <h1 className="mb-6 text-5xl font-black">About TestTech</h1>
        <div className="space-y-6 text-lg leading-relaxed opacity-80">
          <p>TestTech was born from a passion for tech. We curate only the finest products for enthusiasts who demand quality.</p>
          <p>Every item in our collection is hand-picked and tested. We work directly with manufacturers to ensure authenticity and fair pricing.</p>
          <p>Our mission: make premium tech products accessible to everyone, everywhere.</p>
        </div>
      </section>
      <section className="border-t border-gray-800 px-6 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-8 text-center">
          <div><p className="text-3xl font-black">10K+</p><p className="text-sm opacity-60">Happy Customers</p></div>
          <div><p className="text-3xl font-black">500+</p><p className="text-sm opacity-60">Products</p></div>
          <div><p className="text-3xl font-black">24/7</p><p className="text-sm opacity-60">Support</p></div>
        </div>
      </section>
    </div>
  );
}