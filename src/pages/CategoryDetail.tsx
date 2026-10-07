import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PageHeader from '../components/ui/PageHeader';
import CtaBand from '../components/ui/CtaBand';
import { serviceCategories } from '../data/servicesData';
import { useCategoryImages } from '../hooks/useCategoryImages';

export default function CategoryDetailPage() {
  const { categoryId } = useParams();
  const { imagesFor, meta } = useCategoryImages();
  const category = serviceCategories.find((c) => c.id === categoryId);

  if (!category) {
    return <Navigate to="/services" replace />;
  }

  const images = imagesFor(category.id);
  const info = meta(category.id);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />

      <PageHeader
        eyebrow={`Service ${category.accent}`}
        title={category.title}
        description={category.description}
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Services', to: '/services' }, { label: category.title }]}
      >
        {info && (info.startingPrice || info.timeline) && (
          <dl className="flex flex-wrap gap-x-12 gap-y-4 text-sm">
            {info.startingPrice && (
              <div>
                <dt className="text-charcoal/65">Starting from</dt>
                <dd className="mt-1 text-lg font-semibold">{String(info.startingPrice).replace(/^From\s*/i, '')}</dd>
              </div>
            )}
            {info.timeline && (
              <div>
                <dt className="text-charcoal/65">Typical timeline</dt>
                <dd className="mt-1 text-lg font-semibold">{info.timeline}</dd>
              </div>
            )}
          </dl>
        )}
      </PageHeader>

      <main className="section flex-1">
        <div className="container-x">
          {images[0] && (
            <div className="mb-14 aspect-[21/9] overflow-hidden rounded-xl bg-charcoal/5 md:mb-20">
              <img
                src={images[0]}
                alt=""
                width={1600}
                height={686}
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <h2 className="mb-2 text-3xl md:text-4xl">What this includes</h2>
          <ul className="mt-8 divide-y divide-charcoal/10 border-y border-charcoal/10">
            {category.items.map((item, idx) => (
              <motion.li
                key={item.slug}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
              >
                <Link
                  to={`/services/${category.id}/${item.slug}`}
                  className="group grid gap-3 py-7 md:grid-cols-[3rem_1fr_1.4fr_auto] md:items-baseline md:gap-8"
                >
                  <span className="font-serif text-xl text-ochre" aria-hidden="true">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-2xl group-hover:text-ochre">{item.name}</h3>
                  <p className="text-[15px] leading-relaxed text-charcoal/75">{item.desc}</p>
                  <span className="hidden items-center gap-1.5 text-sm font-semibold text-charcoal group-hover:text-ochre md:inline-flex">
                    Details
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        </div>
      </main>

      <CtaBand
        title={`Planning ${category.title.toLowerCase()}?`}
        description="Tell us about your space and we will give you a clear scope, timeline and price. The first consultation is free."
        whatsappText={`Hello Pamnim Interiors, I'd like to ask about ${category.title.toLowerCase()}.`}
      />
      <Footer />
    </div>
  );
}
