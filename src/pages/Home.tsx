import Header from '../components/Header';
import Hero from '../components/Hero';
import Services from '../components/Services';
import Testimonials from '../components/Testimonials';
import Portfolio from '../components/Portfolio';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Services />
        <Testimonials />
        <Portfolio />
      </main>
      <Footer />
    </div>
  );
}
