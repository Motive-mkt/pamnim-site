import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { motion } from 'motion/react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function PortfolioPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const q = query(collection(db, 'portfolio'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching portfolio:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  return (
    <div className="min-h-screen bg-cream">
      <Header />
      
      <main className="pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center mb-16">
          <span className="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block">PORTFOLIO</span>
          <h1 className="text-5xl md:text-7xl font-sans font-bold mb-6">Our Exceptional Works.</h1>
          <p className="text-xl text-charcoal/60 max-w-2xl mx-auto">
            A curated collection of our finest interior transformations and architectural achievements.
          </p>
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="aspect-[4/5] bg-charcoal/5 animate-pulse rounded-3xl" />
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {projects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group relative aspect-[4/5] overflow-hidden rounded-3xl cursor-pointer"
                >
                  <img 
                    src={project.image} 
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-ochre text-xs font-bold uppercase mb-2">{project.category}</span>
                    <h3 className="text-white text-2xl font-bold">{project.title}</h3>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-32 bg-white rounded-[3rem] border border-charcoal/5">
              <h2 className="text-2xl font-bold text-charcoal/30">Portfolio images will appear here once added by the owner.</h2>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
