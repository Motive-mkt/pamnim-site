import { motion } from 'motion/react';
import { Compass, Layers, Grid, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LUXURY_CATEGORIES = [
  {
    id: "interior-architecture",
    title: "Interior Architecture & Space Planning",
    description: "Architectural integrity meets elegant spatial design. We optimize layouts for flawless daily flow, design sculptural gypsum ceiling works, and craft highly efficient culinary kitchens.",
    items: ["Space Planning", "Kitchen Planning", "Gypsum & Ceiling Works"],
    icon: Compass,
    accent: "01"
  },
  {
    id: "bespoke-finishes",
    title: "Bespoke Finishes & Craftsmanship",
    description: "The fine surface and structural details that establish character and distinction. Custom architectural wainscoting, perfect joinery, and meticulously applied professional finishes.",
    items: ["Wainscoting & Wall Paneling", "Cabinet Fittings & Joinery", "Professional Painting"],
    icon: Layers,
    accent: "02"
  },
  {
    id: "premium-flooring",
    title: "Premium Flooring Solutions",
    description: "Premium foundations that support refined living. We fit pristine ceramic and porcelain tiling, sound-damped SPC/LVT boards, and seamless architectural epoxy coatings.",
    items: ["Ceramic & Porcelain", "SPC & LVT Flooring", "Epoxy Coating"],
    icon: Grid,
    accent: "03"
  },
  {
    id: "lighting-textures-styling",
    title: "Lighting, Textures & Styling",
    description: "The sensory layering of light, fabric, and ambiance. Curated architectural lighting distributions, luxury drapery and blind systems, and immersive 3D simulations of your future home.",
    items: ["Architectural Lighting", "Curtain Works & Blinds", "Consultation & 3D Visualization"],
    icon: Sparkles,
    accent: "04"
  }
];

export default function Services() {
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

        {/* 2x2 Services Grid with Thin Clean Borders and Generous Padding */}
        <div className="grid md:grid-cols-2 border border-charcoal/5 rounded-3xl overflow-hidden bg-white/50 backdrop-blur-sm shadow-sm">
          {LUXURY_CATEGORIES.map((category, index) => {
            const Icon = category.icon;
            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                className={`p-8 md:p-12 lg:p-16 flex flex-col justify-between transition-all duration-500 hover:bg-white group relative ${
                  index === 0 ? "border-b md:border-r border-charcoal/5" : ""
                } ${
                  index === 1 ? "border-b border-charcoal/5" : ""
                } ${
                  index === 2 ? "border-b md:border-b-0 md:border-r border-charcoal/5" : ""
                } ${
                  index === 3 ? "" : ""
                }`}
              >
                {/* Accent Number in Corner */}
                <div className="absolute top-8 right-8 text-xs font-mono tracking-widest text-charcoal/10 group-hover:text-ochre/20 transition-colors">
                  {category.accent}
                </div>

                <div>
                  {/* Icon & Category Index */}
                  <div className="w-12 h-12 rounded-xl bg-cream flex items-center justify-center mb-8 border border-charcoal/5 group-hover:bg-ochre group-hover:border-ochre transition-all duration-300">
                    <Icon className="w-5 h-5 text-ochre group-hover:text-white transition-all duration-300" />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl lg:text-3xl font-serif text-charcoal font-medium mb-4 group-hover:text-ochre transition-colors duration-300">
                    {category.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-charcoal/50 leading-relaxed font-sans mb-8">
                    {category.description}
                  </p>
                </div>

                {/* Sub-items List with Custom Bullet Tags */}
                <div className="pt-6 border-t border-charcoal/5">
                  <p className="text-[10px] font-bold tracking-[0.2em] text-charcoal/30 uppercase mb-3">INCLUDED SOLUTIONS</p>
                  <ul className="flex flex-wrap gap-x-6 gap-y-2">
                    {category.items.map((item, id) => (
                      <li key={id} className="flex items-center gap-1.5 text-xs text-charcoal/70 bg-cream/80 px-3 py-1.5 rounded-full border border-charcoal/5">
                        <span className="w-1 h-1 rounded-full bg-ochre" />
                        <span className="font-sans font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
