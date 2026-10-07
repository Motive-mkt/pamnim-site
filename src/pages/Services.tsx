import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PageHeader from '../components/ui/PageHeader';
import CtaBand from '../components/ui/CtaBand';
import { serviceCategories } from '../data/servicesData';
import { useCategoryImages } from '../hooks/useCategoryImages';

export default function ServicesPage() {
  const { imagesFor } = useCategoryImages();

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />

      <PageHeader
        eyebrow="Services"
        title="What we design and build."
        description="Four services that cover a home from first layout to final finishing. Pick one, or combine them in a single project."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Services' }]}
      />

      <main className="section flex-1">
        <div className="container-x grid gap-x-8 gap-y-16 md:grid-cols-2 lg:gap-x-12">
          {serviceCategories.map((category, index) => {
            const image = imagesFor(category.id)[0];
            return (
              <motion.article
                key={category.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: (index % 2) * 0.08 }}
                className="group flex flex-col"
              >
                <Link
                  to={`/services/${category.id}`}
                  className="block overflow-hidden rounded-xl bg-charcoal/5"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <div className="aspect-[4/3]">
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        width={1200}
                        height={900}
                        loading={index < 2 ? 'eager' : 'lazy'}
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-paper font-serif text-6xl text-charcoal/15">
                        {category.accent}
                      </div>
                    )}
                  </div>
                </Link>

                <div className="mt-6 flex items-baseline gap-4">
                  <span className="font-serif text-xl text-ochre" aria-hidden="true">
                    {category.accent}
                  </span>
                  <h2 className="text-[1.75rem] leading-tight">
                    <Link to={`/services/${category.id}`} className="hover:text-ochre">
                      {category.title}
                    </Link>
                  </h2>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-charcoal/75 md:pl-9">{category.description}</p>

                <ul className="mt-5 divide-y divide-charcoal/10 border-y border-charcoal/10 md:ml-9">
                  {category.items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        to={`/services/${category.id}/${item.slug}`}
                        className="flex min-h-11 items-center justify-between gap-4 py-2.5 text-[15px] text-charcoal hover:text-ochre"
                      >
                        {item.name}
                        <ArrowRight className="h-4 w-4 shrink-0 text-charcoal/40 transition-transform group-hover:translate-x-0" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>

                <Link to={`/services/${category.id}`} className="btn-link mt-5 self-start md:ml-9">
                  View service
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </motion.article>
            );
          })}
        </div>
      </main>

      <CtaBand
        title="Tell us about your home."
        description="Share your space and budget and we will recommend where to start. The first consultation is free."
      />
      <Footer />
    </div>
  );
}
