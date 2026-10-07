import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { ReactNode } from 'react';
import { useCMS } from '../../hooks/useCMS';

interface CtaBandProps {
  title: ReactNode;
  description?: string;
  /** Pre-filled WhatsApp message */
  whatsappText?: string;
}

/** Closing call to action shared by the service pages: one primary button, one quiet alternative. */
export default function CtaBand({ title, description, whatsappText }: CtaBandProps) {
  const { content } = useCMS();
  const wa = `https://wa.me/${content.contact.whatsapp}?text=${encodeURIComponent(
    whatsappText || "Hello Pamnim Interiors, I'd like to ask about a project."
  )}`;

  return (
    <section className="section">
      <div className="container-x">
        <div className="dark-surface flex flex-col items-start justify-between gap-8 rounded-2xl bg-charcoal p-8 text-white md:flex-row md:items-center md:p-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl text-white md:text-4xl">{title}</h2>
            {description && <p className="mt-3 text-[15px] leading-relaxed text-white/80">{description}</p>}
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link to="/contact" className="btn btn-primary btn-lg">
              Get a quote
            </Link>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline-light btn-lg">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              WhatsApp us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
