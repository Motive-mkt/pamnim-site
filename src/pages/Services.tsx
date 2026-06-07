import { motion } from 'motion/react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Compass, Layers, Grid, Sparkles, ArrowRight, MessageSquare, Phone, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCMS } from '../hooks/useCMS';

const DETAILS_CATEGORIES = [
  {
    no: "I",
    id: "interior-architecture",
    title: "Interior Architecture & Space Planning",
    subtitle: "The Structural Masterplan",
    description: "Every exceptional home begins with precise, calculated spatial configurations. We dissect daily movement pattern flow, optimize visual sightlines, and establish a framework of ultimate comfort and performance.",
    items: [
      { name: "Space Planning", desc: "Intelligent layout plans maximizing usable square footage with premium functional flow, custom furniture positioning, and architectural flow guides." },
      { name: "Kitchen Planning", desc: "Expert zoning, appliance integration, custom work triangle optimization, and ergonomic casework layout designed for elite homes." },
      { name: "Gypsum & Ceiling Works", desc: "Sculpted dry-wall ceilings, shadowline details, dropped acoustic plaster ceiling architectures, and integrated cove lighting pockets." }
    ],
    icon: Compass,
    bgAccent: "bg-ochre/5",
    themeColor: "text-ochre"
  },
  {
    no: "II",
    id: "bespoke-finishes",
    title: "Bespoke Finishes & Craftsmanship",
    subtitle: "Texture, Tactility & Custom Joinery",
    description: "Surfaces define character, luxury, and durability. Our master artisans hand-apply beautiful wainscoting paneling and custom cabinet joinery, bringing exceptional bespoke craftsmanship directly to your living environment.",
    items: [
      { name: "Wainscoting & Wall Paneling", desc: "Elegant shaker paneling, classical raised-molding wainscots, modern fluted timber panel accents, and bespoke drywall detailing." },
      { name: "Cabinet Fittings & Joinery", desc: "State-of-the-art kitchen cabinets, bespoke entry consoles, luxury walk-in wardrobes, and heavy wood custom bookcases with soft-close mechanisms." },
      { name: "Professional Painting", desc: "Pristine dustless surface preparation, seamless plaster skim coatings, premium eco-friendly matte finishes, and designer feature accent walls." }
    ],
    icon: Layers,
    bgAccent: "bg-charcoal/5",
    themeColor: "text-charcoal"
  },
  {
    no: "III",
    id: "premium-flooring",
    title: "Premium Flooring Solutions",
    description: "The foundation of sensory perfection. We match ground surfaces with highly durable materials that look flawless and stand the test of time, reducing sound transmission and enhancing thermal properties.",
    subtitle: "Flawless Ground Foundations",
    items: [
      { name: "Ceramic & Porcelain", desc: "Laser-aligned tile arrangements, custom-cut formats, elegant polished or honed tile surfaces, and masterfully applied uniform epoxy grout." },
      { name: "SPC & LVT Flooring", desc: "Stone Plastic Composite and Luxury Vinyl Tile boards offering 100% water resistance, premium sound dampening underlays, and hyper-realistic wood designs." },
      { name: "Epoxy Coating", desc: "Ultra-sleek glossy residential garage coatings, seamless self-leveling industrial floors, and premium flake systems built for maximum wear resistance." }
    ],
    icon: Grid,
    bgAccent: "bg-ochre/5",
    themeColor: "text-ochre"
  },
  {
    no: "IV",
    id: "lighting-textures-styling",
    title: "Lighting, Textures & Styling",
    description: "The ethereal layer that breathes soul into physical spaces. Through calculated luminary distributions, carefully specified fabric hangs, and advanced 3D previews, we refine the visual environment to perfection.",
    subtitle: "Atmosphere & Spatial Aesthetics",
    items: [
      { name: "Architectural Lighting", desc: "Carefully positioned glare-free recessed cans, ambient LED strip placements, focus-accent spot tracks, and statement designer pendants." },
      { name: "Curtain Works & Blinds", desc: "Custom double-track sheer and motorized blackout drapery, textured Roman blinds, and premium architectural roller sunscreen fabrics." },
      { name: "Consultation & 3D Visualization", desc: "Full-color photorealistic interior walkthroughs, finish selection guides, customized digital mood boards, and live design workshops." }
    ],
    icon: Sparkles,
    bgAccent: "bg-charcoal/5",
    themeColor: "text-charcoal"
  }
];

export default function ServicesPage() {
  const { content } = useCMS();

  return (
    <div className="min-h-screen bg-cream">
      <Header />

      {/* Hero Banner Section */}
      <section className="pt-36 pb-20 relative overflow-hidden bg-cream border-b border-charcoal/5">
        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 text-center">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block"
          >
            OUR CORE DISCIPLINES
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-serif text-charcoal font-medium mb-6 leading-tight max-w-4xl mx-auto"
          >
            Refined Services & <span className="italic font-light">Elevated Architecture</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg md:text-xl text-charcoal/60 max-w-2xl mx-auto leading-relaxed"
          >
            Experience our comprehensive design spectrum, carefully structured to assure pristine finish quality and warm minimalist sophistication.
          </motion.p>
        </div>
      </section>

      {/* Main Structural Categories List */}
      <main className="py-24 space-y-32">
        {DETAILS_CATEGORIES.map((category, index) => {
          const Icon = category.icon;
          const isEven = index % 2 === 0;

          return (
            <section 
              key={category.id} 
              id={category.id}
              className="max-w-7xl mx-auto px-6 md:px-12 scroll-mt-24"
            >
              <div className={`grid lg:grid-cols-12 gap-12 lg:gap-20 items-stretch`}>
                
                {/* Structural Category Intro Panel */}
                <div className={`lg:col-span-5 flex flex-col justify-between ${isEven ? 'lg:order-1' : 'lg:order-2'}`}>
                  <div>
                    {/* Index Counter */}
                    <div className="flex items-center gap-3 mb-6">
                      <span className="font-mono text-sm tracking-widest text-ochre font-extrabold">{category.no}</span>
                      <div className="h-[1px] w-8 bg-ochre/20" />
                      <span className="text-[10px] font-bold tracking-[0.15em] text-charcoal/40 uppercase">{category.subtitle}</span>
                    </div>

                    {/* Headline */}
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-medium text-charcoal leading-tight mb-6">
                      {category.title}
                    </h2>

                    {/* Description Paragraph */}
                    <p className="text-charcoal/60 leading-relaxed font-sans mb-8">
                      {category.description}
                    </p>
                  </div>

                  {/* Icon Card Shield */}
                  <div className={`hidden lg:flex items-center gap-4 p-6 rounded-2xl border border-charcoal/5 bg-white shadow-sm`}>
                    <div className="w-12 h-12 rounded-xl bg-cream flex items-center justify-center border border-charcoal/5">
                      <Icon className="w-5 h-5 text-ochre" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-charcoal tracking-wide uppercase">DEDICATED QUALITY ASSURED</p>
                      <p className="text-xs text-charcoal/40 font-sans mt-0.5">Executed under our strict craftsmanship protocols.</p>
                    </div>
                  </div>
                </div>

                {/* Sub-services Detailed Solutions Panel */}
                <div className={`lg:col-span-7 flex flex-col justify-center ${isEven ? 'lg:order-2' : 'lg:order-1'}`}>
                  <div className="bg-white rounded-3xl border border-charcoal/5 p-8 md:p-12 shadow-sm space-y-8 relative overflow-hidden">
                    <div className={`absolute -right-24 -bottom-24 w-60 h-60 rounded-full ${category.bgAccent} blur-3xl opacity-50`} />
                    
                    <h3 className="text-xs font-bold tracking-[0.2em] text-charcoal/30 uppercase pb-4 border-b border-charcoal/5">
                      DETAILED SERVICE BREAKDOWN
                    </h3>

                    <div className="space-y-8 relative z-10">
                      {category.items.map((subItem, keyId) => (
                        <div key={keyId} className="group flex gap-4 transition-all duration-300">
                          <div className="mt-1 flex-shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-ochre" />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-charcoal group-hover:text-ochre transition-colors duration-300">
                              {subItem.name}
                            </h4>
                            <p className="text-sm text-charcoal/50 leading-relaxed font-sans mt-1">
                              {subItem.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </section>
          );
        })}
      </main>

      {/* High-End Luxury Call to Action Section */}
      <section className="py-24 bg-cream">
        <div className="max-w-5xl mx-auto px-6 md:px-12 text-center">
          <div className="bg-charcoal text-white rounded-[3rem] p-10 md:p-16 relative overflow-hidden border border-white/5 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-ochre to-transparent opacity-50" />
            
            <div className="relative z-10 space-y-6">
              <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase block">TAILORED SOLUTIONS</span>
              
              <h2 className="text-4xl md:text-5xl font-serif font-medium leading-tight max-w-2xl mx-auto">
                Ready to materialize your <span className="italic font-light text-ochre-light">dream space?</span>
              </h2>
              
              <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                Connect with our design curators. We will discuss your layout possibilities, budget considerations, and aesthetic preferences without any initial obligation.
              </p>

              <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a 
                  href={`https://wa.me/${content.contact.whatsapp}?text=Hello%20Pamnim%20Interiors!%20I'd%20like%20to%20book%20a%20consultation.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto bg-ochre hover:bg-ochre/90 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-ochre/20"
                >
                  <MessageSquare className="w-5 h-5" />
                  Chat via WhatsApp
                </a>
                
                <Link 
                  to="/contact"
                  className="w-full sm:w-auto bg-white/10 hover:bg-white/15 border border-white/10 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300"
                >
                  <Phone className="w-5 h-5" />
                  Fill Contact Form
                </Link>
              </div>
            </div>
            
            {/* Subtle background ambiance */}
            <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-ochre/10 blur-3xl opacity-30" />
            <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-ochre/10 blur-3xl opacity-30" />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
