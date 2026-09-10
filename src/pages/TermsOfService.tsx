// NOTICE: These Terms of Service contain starter text provided for operational guidance.
// The business owner should review and customize these terms—ideally with qualified legal counsel—
// before relying on them as a final binding legal contract under Kenyan law.

import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Scale, CheckCircle2, Clock, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCMS } from '../hooks/useCMS';

export default function TermsOfService() {
  const { content } = useCMS();

  return (
    <div className="min-h-screen bg-cream text-charcoal flex flex-col justify-between">
      <Header />

      <main className="flex-1 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-8">
          
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ochre hover:text-ochre-dark mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>

          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-charcoal/10 shadow-sm space-y-8">
            <div className="border-b border-charcoal/10 pb-6">
              <div className="w-12 h-12 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center mb-4">
                <Scale className="w-6 h-6" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-charcoal">Terms of Service</h1>
              <p className="text-xs text-charcoal/50 mt-2">
                Effective: September 2026 · Pamnim Interior Designers (Nairobi, Kenya)
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-charcoal flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-ochre" /> 1. Scope of Design & Joinery Services
              </h2>
              <p className="text-sm text-charcoal/80 leading-relaxed">
                Pamnim Interior Designers provides premium bespoke interior architecture, 3D renderings, material procurement, customized cabinetry and joinery fabrication, and turnkey on-site fit-out services for residential and commercial spaces across Kenya.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-charcoal flex items-center gap-2">
                <Clock className="w-5 h-5 text-ochre" /> 2. Quotations & Validity Period
              </h2>
              <p className="text-sm text-charcoal/80 leading-relaxed">
                All formal written quotations generated through our estimating portal are valid for <strong>30 calendar days</strong> from the date of issuance, unless otherwise explicitly specified on the document. Due to fluctuating timber, imported hardware, and raw material market costs, quotations accepted after 30 days may be subject to price re-evaluation.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-charcoal flex items-center gap-2">
                <Scale className="w-5 h-5 text-ochre" /> 3. Payment Terms & Milestone Invoicing
              </h2>
              <p className="text-sm text-charcoal/80 leading-relaxed">
                Payments must be settled in accordance with the specific terms noted on your issued invoice (e.g. 50% commitment deposit prior to joinery fabrication and material procurement, 30% upon delivery to site, and 20% upon final snagging and project handover):
              </p>
              <ul className="list-disc list-inside text-sm text-charcoal/70 space-y-1.5 pl-2">
                <li><strong className="text-charcoal">Deposit Requirement:</strong> Work on customized carpentry, cutting lists, and procurement commences only upon receipt of the agreed deposit.</li>
                <li><strong className="text-charcoal">Payment Methods:</strong> Official payments are received via the approved bank transfer accounts or official M-Pesa business numbers detailed on your invoice or receipt.</li>
                <li><strong className="text-charcoal">Payment Receipts:</strong> A formal electronic Payment Receipt is generated and archived for every installment logged in the system.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-charcoal flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-ochre" /> 4. Client Changes, Approvals & Cancellations
              </h2>
              <p className="text-sm text-charcoal/80 leading-relaxed">
                Our 4-stage visual tracker ensures clear checkpoints before milestone work begins:
              </p>
              <ul className="list-disc list-inside text-sm text-charcoal/70 space-y-1.5 pl-2">
                <li><strong className="text-charcoal">Stage Sign-Off:</strong> Once materials or 3D concepts are approved and cutting/fabrication commences, any structural changes requested by the client may incur additional material and labor variations.</li>
                <li><strong className="text-charcoal">Cancellations:</strong> In the event of a cancellation initiated by the client after procurement has started, actual costs incurred for non-refundable materials, factory joinery hours, and design drafting will be deducted from any refundable deposit balance.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-charcoal">5. Intellectual Property & Photography</h2>
              <p className="text-sm text-charcoal/80 leading-relaxed">
                All 3D design renderings, drawings, and custom joinery designs generated by Pamnim Interior Designers remain our intellectual property. We reserve the right to document completed interior works photographically for our portfolio and marketing, while respecting client privacy by anonymizing exact residential addresses.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-charcoal">6. Contact & Disputes</h2>
              <p className="text-sm text-charcoal/80 leading-relaxed">
                We pride ourselves on transparent communication and handcrafted quality. Any questions regarding terms, billing, or site warranties can be directed to our leadership team:
              </p>
              <div className="p-4 rounded-2xl bg-cream/70 border border-charcoal/10 text-xs text-charcoal/80 space-y-1">
                <p><strong className="text-charcoal">Pamnim Interior Designers</strong></p>
                <p>Email: {content.contact.email} · Phone: {content.contact.phone}</p>
                <p>Location: {content.contact.address}</p>
              </div>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
