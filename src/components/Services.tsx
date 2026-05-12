import { motion } from 'motion/react';
import { Home, Palette, LayoutGrid, PaintBucket, RefreshCcw, MessageSquare } from 'lucide-react';

const services = [
  {
    icon: Home,
    title: "Residential Interior Design",
    description: "End-to-end design for homes that balance beauty and everyday function."
  },
  {
    icon: Palette,
    title: "Space Styling & Decoration",
    description: "Curated styling that brings warmth, color and personality to every room."
  },
  {
    icon: LayoutGrid,
    title: "Furniture & Layout Arrangement",
    description: "Smart layouts that maximize flow, comfort, and natural light."
  },
  {
    icon: PaintBucket,
    title: "Interior Finishing & Aesthetic",
    description: "Refined finishes — paint, lighting, textures — that elevate your space."
  },
  {
    icon: RefreshCcw,
    title: "Renovation & Design Upgrades",
    description: "Practical upgrades that modernize your home without the overhaul."
  },
  {
    icon: MessageSquare,
    title: "Design Consultation",
    description: "One-on-one guidance to help you make confident design decisions."
  }
];

export default function Services() {
  return (
    <section className="py-24 bg-cream/50" id="services">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div id="services-header" className="max-w-2xl mb-16">
          <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block">WHAT WE DO</span>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Beautifully crafted interiors, designed around you.</h2>
          <p className="text-lg text-charcoal/60 leading-relaxed">
            From the first sketch to the final styled corner, we manage every detail with care.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white p-10 rounded-2xl border border-charcoal/5 hover:border-ochre/30 transition-all duration-300 group hover:shadow-xl hover:shadow-ochre/5"
            >
              <div className="w-12 h-12 rounded-xl bg-ochre/10 flex items-center justify-center mb-6 group-hover:bg-ochre transition-colors duration-300">
                <service.icon className="w-6 h-6 text-ochre group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="text-xl font-bold mb-4 group-hover:text-ochre transition-colors duration-300">{service.title}</h3>
              <p className="text-charcoal/60 leading-relaxed">{service.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
