import { motion } from 'motion/react';

const projects = [
  {
    title: "Navy & Marble Contemporary Kitchen",
    category: "Full Kitchen Design",
    image: "/input_file_2.png",
    className: "md:col-span-2 md:row-span-2"
  },
  {
    title: "Polished Grey Interior Finish",
    category: "Space Styling",
    image: "/input_file_1.png",
    className: "md:col-span-1 md:row-span-1"
  },
  {
    title: "Signature Residential Exterior",
    category: "Exterior Architecture",
    image: "/input_file_3.png",
    className: "md:col-span-1 md:row-span-1"
  }
];

export default function Portfolio() {
  return (
    <section className="py-24 bg-cream" id="portfolio">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div id="portfolio-header" className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block">OUR WORK</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Recent projects we're proud of.</h2>
            <p className="text-lg text-charcoal/60">
              A glimpse into the homes and spaces we've transformed for clients across the region.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-ochre font-bold flex items-center gap-2 group"
          >
            View all projects <span className="group-hover:translate-x-1 transition-transform">→</span>
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
          {projects.map((project, index) => (
            <motion.div
              key={project.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative overflow-hidden rounded-3xl group cursor-pointer ${project.className}`}
            >
              <img
                src={project.image}
                alt={project.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-8">
                <span className="text-ochre-light text-xs font-bold uppercase tracking-widest mb-2">{project.category}</span>
                <h3 className="text-white text-2xl font-bold">{project.title}</h3>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
