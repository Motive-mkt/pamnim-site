import { Mail, Phone, MapPin, MessageSquare } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PageHeader from '../components/ui/PageHeader';
import LeadQualifyingForm from '../components/LeadQualifyingForm';
import { useCMS } from '../hooks/useCMS';
import { isFreeMailAddress } from '../lib/utils';

export default function ContactPage() {
  const { content } = useCMS();
  const { phone, email, address, whatsapp } = content.contact;
  // Free consumer addresses are left off the public page until a branded one is set in the admin
  const showEmail = !!email && !isFreeMailAddress(email);

  const rows = [
    { icon: Phone, label: 'Call', value: phone, href: `tel:${phone.replace(/\s/g, '')}` },
    {
      icon: MessageSquare,
      label: 'WhatsApp',
      value: 'Message us',
      href: `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hello Pamnim Interiors, I'd like to ask about a project.")}`,
      external: true
    },
    ...(showEmail ? [{ icon: Mail, label: 'Email', value: email, href: `mailto:${email}` }] : []),
    { icon: MapPin, label: 'Visit', value: address, href: undefined as string | undefined }
  ];

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />

      <PageHeader
        eyebrow="Contact"
        title="Let's talk about your space."
        description="Call, message us on WhatsApp or send the form. We reply within one working day, and the first consultation is free."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Contact' }]}
      />

      <main className="section flex-1">
        <div className="container-x grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <ul className="divide-y divide-charcoal/10 border-y border-charcoal/10">
            {rows.map(({ icon: Icon, label, value, href, external }) => {
              const body = (
                <>
                  <Icon className="mt-1 h-5 w-5 shrink-0 text-ochre" aria-hidden="true" />
                  <span>
                    <span className="block text-sm text-charcoal/65">{label}</span>
                    <span className="mt-0.5 block break-words text-lg font-medium text-charcoal">{value}</span>
                  </span>
                </>
              );
              return (
                <li key={label}>
                  {href ? (
                    <a
                      href={href}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="flex min-h-[72px] items-start gap-4 py-5 hover:text-ochre"
                    >
                      {body}
                    </a>
                  ) : (
                    <div className="flex min-h-[72px] items-start gap-4 py-5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>

          <LeadQualifyingForm
            variant="card"
            source="contact_page"
            title="Send us your project details"
            subtitle="Whether you are renovating, building or just collecting ideas, we are happy to help."
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
