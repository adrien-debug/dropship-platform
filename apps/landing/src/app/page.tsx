import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import Products from '@/components/Products';
import UnderstandUsers from '@/components/UnderstandUsers';
import Partners from '@/components/Partners';
import RequestDemo from '@/components/RequestDemo';
import Footer from '@/components/Footer';

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Products />
        <UnderstandUsers />
        <Partners />
        <RequestDemo />
      </main>
      <Footer />
    </>
  );
}
