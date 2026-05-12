import { motion } from 'motion/react';
import { Star } from 'lucide-react';

export default function Testimonials() {
  return (
    <section className="py-24 bg-white" id="testimonials">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div id="testimonials-header" className="text-center mb-16">
          <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block">CLIENT LOVE</span>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">A 5-star experience.</h2>
          <div className="flex justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 fill-ochre text-ochre" />
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Card 1 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="p-10 rounded-3xl bg-cream border border-charcoal/5 relative overflow-hidden"
          >
            <div className="flex gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-ochre text-ochre" />
              ))}
            </div>
            <p className="text-xl text-charcoal/80 leading-relaxed italic mb-8 relative z-10">
              "Excellent service and great results — the team understood exactly what we wanted and delivered beyond our expectations."
            </p>
            <div>
              <p className="font-bold">Verified Client</p>
              <p className="text-sm text-charcoal/40">Residential Project</p>
            </div>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="p-10 rounded-3xl bg-charcoal text-white relative overflow-hidden"
          >
            <div className="flex gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-ochre text-ochre" />
              ))}
            </div>
            <p className="text-xl text-white/80 leading-relaxed italic mb-8 relative z-10">
              "Professional, attentive and detail-driven. Our home finally feels like the space we always imagined."
            </p>
            <div>
              <p className="font-bold">Happy Homeowner</p>
              <p className="text-sm text-white/40">Full Home Styling</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
