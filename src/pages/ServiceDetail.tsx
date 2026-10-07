import { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PageHeader from '../components/ui/PageHeader';
import CtaBand from '../components/ui/CtaBand';
import { serviceCategories } from '../data/servicesData';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { optimizeHeroCloudinaryUrl } from '../services/cloudinaryService';
import { useCategoryImages } from '../hooks/useCategoryImages';

export default function ServiceDetailPage() {
  const { categoryId, serviceSlug } = useParams();
  const [dbService, setDbService] = useState<any>(null);
  const { imagesFor } = useCategoryImages();

  // Hooks must run before any early return
  useEffect(() => {
    let cancelled = false;
    const fetchDbService = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'detailedServices', `${categoryId}_${serviceSlug}`));
        if (!cancelled && docSnap.exists()) setDbService(docSnap.data());
      } catch (err) {
        console.error('Error fetching detailed service:', err);
      }
    };
    setDbService(null);
    fetchDbService();
    return () => {
      cancelled = true;
    };
  }, [categoryId, serviceSlug]);

  const category = serviceCategories.find((c) => c.id === categoryId);
  if (!category) {
    return <Navigate to="/services" replace />;
  }

  const staticService = category.items.find((s) => s.slug === serviceSlug);
  if (!staticService) {
    return <Navigate to={`/services/${category.id}`} replace />;
  }

  // Owner-edited content wins over the built-in defaults
  const serviceName = dbService?.name || staticService.name;
  const serviceDesc = dbService?.desc || staticService.desc;
  const categoryPhoto = imagesFor(category.id)[0];
  const heroImage: string | undefined = dbService?.heroImage || staticService.heroImage || categoryPhoto;
  const galleryImages: string[] = ((dbService?.images || staticService.images || []) as string[]).filter(Boolean);

  const otherServices = category.items.filter((s) => s.slug !== staticService.slug);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />

      <PageHeader
        eyebrow={category.title}
        title={serviceName}
        description={serviceDesc}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Services', to: '/services' },
          { label: category.title, to: `/services/${category.id}` },
          { label: serviceName }
        ]}
      />

      <main className="section flex-1">
        <div className="container-x">
          {heroImage && (
            <div className="aspect-[21/9] overflow-hidden rounded-xl bg-charcoal/5">
              <img
                src={optimizeHeroCloudinaryUrl(heroImage)}
                alt=""
                width={1600}
                height={686}
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {galleryImages.length > 0 && (
            <div className="mt-14 md:mt-20">
              <h2 className="mb-6 text-3xl md:text-4xl">Project photos</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
                {galleryImages.map((imgUrl, index) => (
                  <div key={`${imgUrl}-${index}`} className="aspect-[4/3] overflow-hidden rounded-xl bg-charcoal/5">
                    <img
                      src={imgUrl}
                      alt=""
                      width={1200}
                      height={900}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.03]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {otherServices.length > 0 && (
            <div className="mt-14 md:mt-20">
              <h2 className="mb-2 text-3xl md:text-4xl">Also in {category.title.toLowerCase()}</h2>
              <ul className="mt-6 divide-y divide-charcoal/10 border-y border-charcoal/10">
                {otherServices.map((item) => (
                  <li key={item.slug}>
                    <Link
                      to={`/services/${category.id}/${item.slug}`}
                      className="group flex min-h-14 items-center justify-between gap-6 py-4 text-lg hover:text-ochre"
                    >
                      <span className="font-serif text-2xl">{item.name}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-charcoal/40 group-hover:text-ochre" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>

      <CtaBand
        title={<>Interested in {serviceName.toLowerCase()}?</>}
        description="Tell us about your space and we will send a clear scope, timeline and price. The first consultation is free."
        whatsappText={`Hello Pamnim Interiors, I'd like to ask about ${serviceName.toLowerCase()}.`}
      />
      <Footer />
    </div>
  );
}
