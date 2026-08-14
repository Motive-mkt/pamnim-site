import { motion, AnimatePresence } from 'motion/react';
import React, { useState } from 'react';
import { 
  Compass, 
  Layers, 
  Grid, 
  Sparkles, 
  ArrowRight, 
  Check, 
  X, 
  MessageSquare, 
  Calendar, 
  DollarSign, 
  Send, 
  ArrowUpRight,
  Sparkle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useCMS } from '../hooks/useCMS';

export const LUXURY_CATEGORIES = [
  {
    id: "interior-architecture",
    title: "Smart Space Planning & Custom Layouts",
    subtitle: "The Structural Masterplan",
    outcome: "We design spaces that work the way your life does, maximising every square metre of your Nairobi home without compromising on style.",
    bullets: [
      "Smart Spatial & Furniture Layouts",
      "Ergonomic Kitchen & Living Zones",
      "Sculptural Gypsum Works & Ceilings"
    ],
    items: ["Smart Spatial Layouts", "Ergonomic Kitchen Zones", "Sculptural Gypsum Works"],
    icon: Compass,
    accent: "01",
    startingPrice: "From KES 50,000",
    timeline: "2 - 3 Weeks",
    images: [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&q=80&w=1200"
    ],
    whatsappText: "I'm interested in Space Planning & Custom Layouts"
  },
  {
    id: "bespoke-finishes",
    title: "Bespoke Finishes & Premium Carpentry",
    subtitle: "Texture, Tactility & Custom Joinery",
    outcome: "Every surface, fitting, and finish is selected to feel intentional, because the details are what make a home feel expensive, not just designed.",
    bullets: [
      "Custom Wainscoting & Wall Paneling",
      "Floor-to-ceiling Wardrobes & Cabinetry",
      "Dustless Skimming & Flawless Painting"
    ],
    items: ["Premium Wainscoting", "Bespoke Cabinets & Joinery", "Dustless Skimming & Painting"],
    icon: Layers,
    accent: "02",
    isMostRequested: true,
    startingPrice: "From KES 250,000",
    timeline: "3 - 4 Weeks",
    images: [
      "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&q=80&w=1200"
    ],
    whatsappText: "I'm interested in Bespoke Finishes & Premium Carpentry"
  },
  {
    id: "premium-flooring",
    title: "Premium Flooring Solutions",
    subtitle: "Flawless Ground Foundations",
    outcome: "The right floor anchors every room. We source and install premium options including hardwood, engineered, vinyl, and stone, fitted to last and built to impress.",
    bullets: [
      "Laser-Aligned Ceramic & Porcelain Tiling",
      "100% Waterproof SPC & Wood Flooring",
      "Impact & Stain-Resistant Surface Coatings"
    ],
    items: ["Porcelain & Ceramic Tiling", "Waterproof SPC Wood Floors", "Stain-Resistant Coatings"],
    icon: Grid,
    accent: "03",
    startingPrice: "From KES 180,000",
    timeline: "1 - 2 Weeks",
    images: [
      "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=1200"
    ],
    whatsappText: "I'm interested in Premium Flooring Solutions"
  },
  {
    id: "lighting-textures-styling",
    title: "Luxury Lighting, Drapery & Styling",
    subtitle: "Atmosphere & Spatial Aesthetics",
    outcome: "Lighting changes everything. We design ambient, accent, and task lighting schemes that make your home feel warm at 7am and elegant at 7pm.",
    bullets: [
      "Atmospheric Anti-Glare LED Solutions",
      "Elegant Custom Drapery & Window Blinds",
      "Immersive Photorealistic 3D Previews"
    ],
    items: ["Atmospheric LED Lighting", "Custom Drapery & Blinds", "Immersive 3D Previews First"],
    icon: Sparkles,
    accent: "04",
    startingPrice: "From KES 120,000",
    timeline: "1 - 2 Weeks",
    images: [
      "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=1200"
    ],
    whatsappText: "I'm interested in Luxury Lighting, Drapery & Styling"
  }
];

const iconMap: Record<string, any> = {
  Compass,
  Layers,
  Grid,
  Sparkles
};

export default function Services() {
  const { content } = useCMS();
  const dynamicCategories = content.luxuryCategories && content.luxuryCategories.length > 0 
    ? content.luxuryCategories 
    : LUXURY_CATEGORIES;
  const [selectedService, setSelectedService] = useState<any | null>(null);
  
  // Lead submission form state
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadBudget, setLeadBudget] = useState('');
  const [leadNotes, setLeadNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleOpenModal = (service: any) => {
    setSelectedService(service);
    setIsSubmitted(false);
    setLeadName('');
    setLeadEmail('');
    setLeadPhone('');
    setLeadBudget('');
    setLeadNotes('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    
    setIsSubmitting(true);
    try {
      // Save directly to Firestore inquiries collection
      await addDoc(collection(db, 'inquiries'), {
        name: leadName,
        email: leadEmail,
        phone: leadPhone,
        projectType: selectedService.title,
        message: `Quote Request for: ${selectedService.title}\nBudget: ${leadBudget || 'Not specified'}\nMessage: ${leadNotes || 'Interested in this service.'}`,
        status: 'new',
        createdAt: new Date().toISOString()
      });

      if (typeof (window as any).fbq === "function") {
        (window as any).fbq("track", "Lead", {
          content_name: "Services Quote Form",
        });
      }

      setIsSubmitted(true);
      
      // Auto-open prefilled WhatsApp as dynamic follow-up
      const phoneNumber = content?.contact?.whatsapp || "254714984268";
      const prefilledMsg = `Hello Pamnim Interiors! I just submitted a quote request for *${selectedService.title}* on your website.\n\n*Name:* ${leadName}\n*Budget:* ${leadBudget || 'Not specified'}\n*Direct Inquiry:* ${leadNotes || 'I would like to discuss next steps.'}`;
      const waUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(prefilledMsg)}`;
      
      setTimeout(() => {
        window.open(waUrl, '_blank');
      }, 1000);

    } catch (err) {
      console.error("Lead submission error:", err);
      alert("Submission error. Please connect directly via WhatsApp!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-24 bg-cream/70 border-b border-charcoal/5" id="services">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* Section Header */}
        <div id="services-section-header" className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-3 block">OUR EXPERTISE</span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif text-charcoal font-medium leading-tight">
              Curated luxury design, <br />
              <span className="italic font-light">crafted for sophisticated living.</span>
            </h2>
          </div>
          <div className="md:max-w-sm">
            <p className="text-charcoal/60 leading-relaxed font-sans mb-4">
              We group our comprehensive interior design services into four disciplines to ensure absolute precision, luxury craftsmanship, and cohesive execution.
            </p>
            <Link 
              to="/services" 
              className="inline-flex items-center gap-2 text-sm font-bold tracking-wider text-ochre hover:text-charcoal transition-colors group"
            >
              EXPLORE OUR SERVICES PAGE 
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* 2x2 Services Grid with custom high-converting outcome card structure */}
        <div className="grid md:grid-cols-2 gap-px border border-charcoal/5 rounded-[2.5rem] overflow-hidden bg-charcoal/5 shadow-md">
          {dynamicCategories.map((category, index) => {
            const Icon = category.icon || iconMap[category.iconName] || Compass;
            const waNumber = content?.contact?.whatsapp || "254714984268";
            const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(`I'm interested in ${category.title}`)}`;

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`p-8 md:p-12 lg:p-16 flex flex-col justify-between transition-all duration-500 hover:bg-white bg-white/95 relative group cursor-pointer ${
                  category.isMostRequested ? 'ring-2 ring-inset ring-ochre/40 shadow-xl' : ''
                }`}
                onClick={() => handleOpenModal(category)}
              >
                {/* Most Requested Banner Badge */}
                {category.isMostRequested && (
                  <div className="absolute top-8 left-8 bg-ochre text-white text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm select-none z-10 animate-pulse">
                    <Sparkle className="w-3 h-3 fill-current" />
                    MOST REQUESTED
                  </div>
                )}

                {/* Accent Number in Corner */}
                <div className="absolute top-8 right-8 text-xs font-mono tracking-widest text-charcoal/10 group-hover:text-ochre/20 transition-colors">
                  {category.accent}
                </div>

                <div>
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-8 border transition-all duration-300 ${
                    category.isMostRequested 
                      ? 'bg-ochre border-ochre text-white' 
                      : 'bg-cream border-charcoal/5 text-ochre group-hover:bg-ochre group-hover:border-ochre group-hover:text-white'
                  }`}>
                    <Icon className="w-5 h-5 transition-all duration-300" />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl lg:text-3xl font-serif text-charcoal font-medium mb-4 group-hover:text-ochre transition-colors duration-300">
                    {category.title}
                  </h3>

                  {/* Outcome focused sentence */}
                  <p className="text-sm text-charcoal/70 leading-relaxed font-sans mb-8">
                    {category.outcome}
                  </p>

                  {/* 3 Bullet Points for specific deliverables */}
                  <div className="mb-10 space-y-3">
                    {category.bullets.map((bullet, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="w-4 h-4 rounded-full bg-ochre/10 text-ochre flex items-center justify-center mt-0.5 flex-shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3px]" />
                        </div>
                        <span className="text-xs text-charcoal/70 font-medium font-sans">{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Primary CTA and secondary WhatsApp quick redirect */}
                <div className="pt-6 border-t border-charcoal/5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={() => handleOpenModal(category)}
                      className="flex-1 bg-charcoal hover:bg-ochre text-white font-sans text-xs font-bold uppercase tracking-[0.25em] py-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all duration-300 group-hover:translate-y-[-1px] cursor-pointer"
                    >
                      Get a quote
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <Link
                      to={`/services/${category.id}`}
                      className="flex-1 bg-cream hover:bg-ochre/10 hover:text-ochre text-charcoal border border-charcoal/10 font-sans text-xs font-bold uppercase tracking-[0.25em] py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer text-center"
                    >
                      View Category
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>

                  <a 
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 text-xs font-bold text-ochre hover:text-charcoal transition-colors group/link self-center"
                  >
                    Or ask us on WhatsApp 
                    <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Dynamic Budget / Trust Signal Banner */}
        <div className="mt-12 text-center select-none bg-cream border border-charcoal/5 p-6 rounded-3xl max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
          <span className="text-xs font-bold tracking-widest text-ochre uppercase font-mono bg-white px-4 py-1.5 rounded-full border border-charcoal/5">
            BUDGET FLEXIBILITY
          </span>
          <p className="text-xs md:text-sm font-sans font-medium text-charcoal/60">
            We work across a range of budgets. Tell us yours. Projects start from <span className="text-charcoal font-bold font-mono">KES 50,000</span>.
          </p>
        </div>
      </div>

      {/* High-Converting dedicated service modal */}
      <AnimatePresence>
        {selectedService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedService(null)}
              className="fixed inset-0 bg-charcoal/65 backdrop-blur-md"
            />

            {/* Modal Body container */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-cream border border-charcoal/10 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative z-10 p-6 md:p-10 lg:p-12 scrollbar-thin"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedService(null)}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white border border-charcoal/5 hover:border-ochre text-charcoal/50 hover:text-ochre flex items-center justify-center transition-colors z-20 shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="grid md:grid-cols-2 gap-10 items-stretch">
                
                {/* Left Panel: High Quality Context, Scope details, and curated visuals */}
                <div className="flex flex-col justify-between space-y-6">
                  <div>
                    <span className="text-[10px] font-bold tracking-[0.2em] text-ochre uppercase block mb-2">SERVICE DIRECTORY</span>
                    <h3 className="text-3xl font-serif text-charcoal font-medium leading-tight mb-4">
                      {selectedService.title}
                    </h3>
                    <p className="text-sm text-charcoal/60 leading-relaxed mb-6 font-sans">
                      {selectedService.outcome}
                    </p>

                    {/* Timeline & Price Indicators */}
                    <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-charcoal/5 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-ochre/10 text-ochre flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-charcoal/40 tracking-wider uppercase font-mono">TIMELINE</p>
                          <p className="text-xs font-bold text-charcoal">{selectedService.timeline}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-ochre/10 text-ochre flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-charcoal/40 tracking-wider uppercase font-mono">STARTING FROM</p>
                          <p className="text-xs font-bold text-charcoal font-mono">{selectedService.startingPrice}</p>
                        </div>
                      </div>
                    </div>

                    {/* Scope Checklist */}
                    <h4 className="text-[10px] font-bold tracking-[0.2em] text-charcoal/40 uppercase mb-4">WHAT IS INCLUDED IN THE SCOPE</h4>
                    <div className="space-y-3 mb-6">
                      {selectedService.bullets.map((bullet, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="w-4.5 h-4.5 rounded-full bg-ochre/10 text-ochre flex items-center justify-center mt-0.5 flex-shrink-0">
                            <Check className="w-3 h-3 stroke-[2.5px]" />
                          </div>
                          <span className="text-xs text-charcoal/70 font-medium font-sans leading-snug">{bullet}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2 project visuals display */}
                  <div>
                    <h4 className="text-[10px] font-bold tracking-[0.2em] text-charcoal/40 uppercase mb-3">REAL PROJECT PREVIEWS</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedService.images.slice(0, 2).map((img, idx) => (
                        <div key={idx} className="h-28 rounded-2xl overflow-hidden border border-charcoal/5 shadow-sm group">
                          <img 
                            src={img} 
                            alt={`${selectedService.title} Preview`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Panel: Lead Capture Form / Instant WhatsApp Booking */}
                <div className="bg-white rounded-3xl p-6 md:p-8 border border-charcoal/5 flex flex-col justify-between">
                  {!isSubmitted ? (
                    <form onSubmit={handleFormSubmit} className="space-y-5 flex flex-col justify-between h-full">
                      <div>
                        <h4 className="text-lg font-bold text-charcoal">Get an Instant Quote</h4>
                        <p className="text-xs text-charcoal/50 font-sans mt-1 mb-4">
                          Provide your basic needs below to qualify your project details and claim your free first consultation.
                        </p>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-charcoal/50 uppercase tracking-widest mb-1.5 font-mono">Full Name</label>
                            <input 
                              type="text" 
                              required
                              value={leadName}
                              onChange={(e) => setLeadName(e.target.value)}
                              placeholder="e.g. Joy Wambui"
                              className="w-full bg-cream border border-charcoal/5 rounded-xl px-4 py-3 text-xs text-charcoal focus:border-ochre focus:outline-none transition-colors"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-charcoal/50 uppercase tracking-widest mb-1.5 font-mono">Phone Number</label>
                            <input 
                              type="tel" 
                              required
                              value={leadPhone}
                              onChange={(e) => setLeadPhone(e.target.value)}
                              placeholder="e.g. 0712 345 678"
                              className="w-full bg-cream border border-charcoal/5 rounded-xl px-4 py-3 text-xs text-charcoal focus:border-ochre focus:outline-none transition-colors"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-charcoal/50 uppercase tracking-widest mb-1.5 font-mono">Email Address</label>
                            <input 
                              type="email" 
                              required
                              value={leadEmail}
                              onChange={(e) => setLeadEmail(e.target.value)}
                              placeholder="e.g. joy@domain.com"
                              className="w-full bg-cream border border-charcoal/5 rounded-xl px-4 py-3 text-xs text-charcoal focus:border-ochre focus:outline-none transition-colors"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-charcoal/50 uppercase tracking-widest mb-1.5 font-mono">Est. Budget Range (KES)</label>
                            <select 
                              value={leadBudget}
                              onChange={(e) => setLeadBudget(e.target.value)}
                              className="w-full bg-cream border border-charcoal/5 rounded-xl px-4 py-3 text-xs text-charcoal focus:border-ochre focus:outline-none transition-colors appearance-none"
                            >
                              <option value="">Select range...</option>
                              <option value="KES 50K - 150K">KES 50,000 - 150,000</option>
                              <option value="KES 150K - 300K">KES 150,000 - 300,000</option>
                              <option value="KES 300K - 600K">KES 300,000 - 600,000</option>
                              <option value="KES 600K - 1.2M">KES 600,000 - 1,200,000</option>
                              <option value="KES 1.2M+">KES 1,200,000+</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-charcoal/50 uppercase tracking-widest mb-1.5 font-mono">Specific Room or Request Notes</label>
                            <textarea 
                              rows={2}
                              value={leadNotes}
                              onChange={(e) => setLeadNotes(e.target.value)}
                              placeholder="e.g. Modern open plan lounge..."
                              className="w-full bg-cream border border-charcoal/5 rounded-xl px-4 py-3 text-xs text-charcoal focus:border-ochre focus:outline-none transition-colors resize-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 flex flex-col gap-3">
                        <button 
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full bg-ochre hover:bg-ochre/90 text-white font-bold text-xs uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            "Submitting quote..."
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Submit & Open WhatsApp
                            </>
                          )}
                        </button>

                        <a 
                          href={`https://wa.me/${content?.contact?.whatsapp || "254714984268"}?text=${encodeURIComponent(`Hello Pamnim Interiors, I'm requesting an immediate quotation consult on ${selectedService.title}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-charcoal/5 hover:bg-charcoal/10 text-charcoal font-bold text-xs uppercase tracking-widest py-3 rounded-xl flex items-center justify-center gap-2 transition-colors border border-charcoal/5"
                        >
                          <MessageSquare className="w-4 h-4 text-ochre" />
                          Skip form, text on WhatsApp
                        </a>
                      </div>
                    </form>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-10 flex flex-col items-center justify-center h-full space-y-6"
                    >
                      <div className="w-16 h-16 rounded-full bg-green-50 text-green-500 border border-green-200 flex items-center justify-center mb-2 animate-bounce">
                        <Check className="w-8 h-8 stroke-[3px]" />
                      </div>
                      <div>
                        <h4 className="text-xl font-serif text-charcoal font-medium">Inquiry Submitted!</h4>
                        <p className="text-xs text-charcoal/50 font-sans mt-2 leading-relaxed">
                          We have recorded your details. If your WhatsApp has not automatically opened, you can click below to connect with us immediately.
                        </p>
                      </div>

                      <a 
                        href={`https://wa.me/${content?.contact?.whatsapp || "254714984268"}?text=${encodeURIComponent(`Hello Pamnim Interiors! My name is ${leadName} and I just submitted a quote request for *${selectedService.title}* on your website.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-ochre hover:bg-ochre/90 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Open WhatsApp Manually
                      </a>

                      <button 
                        onClick={() => setSelectedService(null)}
                        className="text-xs text-charcoal/40 font-medium underline hover:text-ochre transition-colors"
                      >
                        Return to Homepage
                      </button>
                    </motion.div>
                  )}
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
