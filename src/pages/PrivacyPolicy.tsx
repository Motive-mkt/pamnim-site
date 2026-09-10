// NOTICE: This Privacy Policy contains starter text provided for operational guidance.
// The business owner should review and customize these terms—ideally with qualified legal counsel—
// before relying on them as a final binding legal document under applicable Kenyan and international laws.

import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Shield, Lock, FileText, Mail, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCMS } from '../hooks/useCMS';

export default function PrivacyPolicy() {
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
                <Shield className="w-6 h-6" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-charcoal">Privacy Policy</h1>
              <p className="text-xs text-charcoal/50 mt-2">
                Last updated: September 2026 · Pamnim Interior Designers (Nairobi, Kenya)
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-charcoal flex items-center gap-2">
                <FileText className="w-5 h-5 text-ochre" /> 1. Information We Collect
              </h2>
              <p className="text-sm text-charcoal/80 leading-relaxed">
                When you engage with Pamnim Interior Designers—whether requesting a quote, signing up for the client project tracker, or scheduling a site consultation—we collect personal details required to deliver our interior design services. This includes:
              </p>
              <ul className="list-disc list-inside text-sm text-charcoal/70 space-y-1.5 pl-2">
                <li><strong className="text-charcoal">Contact Details:</strong> Your full name, email address, telephone/WhatsApp number, and residential or site project address.</li>
                <li><strong className="text-charcoal">Project Specifications:</strong> Architectural drawings, floor plans, design preferences, moodboards, site measurements, and photographs.</li>
                <li><strong className="text-charcoal">Billing & Transactions:</strong> Quotations, issued invoices, payment receipts, payment methods (e.g. M-Pesa transaction reference or bank transfer slips), and milestone payment history securely stored in our cloud database (Firebase Firestore).</li>
                <li><strong className="text-charcoal">Account Credentials:</strong> If you register an authorized client portal or employee account, your authentication identifier is managed via Firebase Authentication.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-charcoal flex items-center gap-2">
                <Lock className="w-5 h-5 text-ochre" /> 2. How We Use Your Information
              </h2>
              <p className="text-sm text-charcoal/80 leading-relaxed">
                We use collected information solely for genuine operational and craftsmanship purposes:
              </p>
              <ul className="list-disc list-inside text-sm text-charcoal/70 space-y-1.5 pl-2">
                <li>Preparing tailored commercial quotations and scope breakdown estimates.</li>
                <li>Managing your four-stage project timeline (Concept & 3D, Material Sourcing, Fabrication & Joinery, Final Handover).</li>
                <li>Providing real-time progress updates, photographic records, and direct messaging between you and the design team.</li>
                <li>Issuing official VAT/tax invoices, milestone bills, and verifiable payment receipts.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-charcoal">3. We Never Sell Your Data</h2>
              <p className="text-sm text-charcoal/80 leading-relaxed">
                Pamnim Interior Designers does <strong>not</strong> sell, rent, lease, or monetize your personal information or project data to any third-party marketing companies or brokers. Data is shared exclusively with authorized team members and subcontractors directly involved in fabricating or installing your project under strict confidentiality.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-charcoal">4. Data Storage & Security</h2>
              <p className="text-sm text-charcoal/80 leading-relaxed">
                Our application infrastructure is hosted on Google Cloud Platform and Firebase with industry-standard TLS encryption in transit and AES-256 encryption at rest. Firestore security rules restrict sensitive documents so only authenticated staff and project-linked clients can access respective records.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-charcoal">5. Data Retention & Deletion Requests</h2>
              <p className="text-sm text-charcoal/80 leading-relaxed">
                You have the right to request a complete copy of your stored records or ask for the deletion of your account and personal details once contractual and tax obligations have concluded. To request record deletion or account removal, please reach out to our administration team:
              </p>
              <div className="p-4 rounded-2xl bg-cream/70 border border-charcoal/10 text-xs text-charcoal/80 space-y-1">
                <p><strong className="text-charcoal">Email:</strong> {content.contact.email}</p>
                <p><strong className="text-charcoal">Phone / WhatsApp:</strong> {content.contact.phone}</p>
                <p><strong className="text-charcoal">Physical Studio:</strong> {content.contact.address}</p>
              </div>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
