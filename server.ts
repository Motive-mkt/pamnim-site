import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

// Handle ES Module and CommonJS compatibility for path resolution safely
const __filename = typeof import.meta !== "undefined" && (import.meta as any).url ? fileURLToPath((import.meta as any).url) : "";
const __dirname = path && __filename ? path.dirname(__filename) : "";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Integrated Gemini Copywriter Assistant Endpoint
  app.post("/api/refine-copy", async (req, res) => {
    try {
      const { text, context } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Missing text to refine" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not configured. Falling back to simulated luxury copywriting refinement.");
        // Make simulated fallback classy and clean
        const simulatedRefinedText = `Curated with silent poise, ${text.trim()}. Each element is refined with warm minimalism and artistic intention to evoke deep spatial tranquility.`;
        return res.json({
          success: true,
          text: simulatedRefinedText,
          isSimulated: true
        });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = 
        "You are an expert luxury copywriting assistant for 'Pamnim Interiors,' a high-end interior design studio. " +
        "Your task is to rewrite, refine, and elevate the provided draft copy into premium, warm minimalist, high-end sensory lookbook copywriting. " +
        "Style Guidelines:\n" +
        "- Keep it sophisticated, poetically professional, and deeply elegant.\n" +
        "- Focus on visual poise, raw materials, quiet luxury, spatial tranquility, and architectural grace.\n" +
        "- Avoid exclamation marks, cheesy sales metaphors, or generic marketing slogans.\n" +
        "- Return ONLY the final beautifully refined text itself, without intro, quotes, trailing notes, or conversational fluff.";

      const prompt = `Context: ${context || 'General luxury interior copy'}\nDraft text: "${text}"\nRefined copy:`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const refinedText = response.text?.trim() || "";

      return res.json({
        success: true,
        text: refinedText,
        isSimulated: false
      });
    } catch (error: any) {
      console.error("Gemini copywriting refinement failure:", error);
      return res.status(500).json({ error: error.message || "Failed to refine draft text with AI" });
    }
  });

  // Dedicated AI Portfolio Assistant Endpoint for Pamnim Interiors
  app.post("/api/portfolio-chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Missing message content" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not configured. Falling back to simulated luxury showroom convo.");
        const lastUserMessage = message.trim();
        let simulatedReply = "Welcome to Pamnim Interiors. We design luxury spaces characterized by crisp structural lines and a delicate palette of warm creams. Would you like to connect directly on WhatsApp to learn more?";
        
        const lowerMsg = lastUserMessage.toLowerCase();
        if (lowerMsg.includes("portfolio") || lowerMsg.includes("work") || lowerMsg.includes("project") || lowerMsg.includes("gallery")) {
          simulatedReply = "Our portfolio features beautifully refined residential assets, modern kitchens, and high-end warm minimalist corporate layouts. You can scroll through our portfolio on this page or chat with us on WhatsApp to discuss custom renderings.";
         } else if (lowerMsg.includes("price") || lowerMsg.includes("cost") || lowerMsg.includes("hire") || lowerMsg.includes("book") || lowerMsg.includes("consult")) {
          simulatedReply = "We provide end-to-end bespoke interior architecture. Please use the WhatsApp button on the webpage to connect directly and schedule our custom assessment!";
        } else if (lowerMsg.includes("service") || lowerMsg.includes("renovat") || lowerMsg.includes("styl")) {
          simulatedReply = "We offer home spatial planning, color styling, bespoke custom furnishing accessories, and direct renovation updates. Let's design something marvelous; press the WhatsApp button to proceed.";
        }

        return res.json({
          success: true,
          text: simulatedReply,
          isSimulated: true
        });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = 
        "You are the dedicated AI Portfolio Assistant for 'Pamnim Interiors,' a luxury interior design studio specializing in crafting high-end residential and commercial spaces using a refined, warm minimalist aesthetic.\n\n" +
        "OPERATIONAL CONSTRAINTS (CRITICAL TO PREVENT SYSTEM CONFLICTS):\n" +
        "1. NO FRONT-END DATA MANIPULATION: You are a pure conversational interface. Never write, modify, or attempt to delete data in Firebase Firestore, and never attempt to handle media files or upload directly to Cloudinary.\n" +
        "2. CONVERSION FOCUS: Your ultimate goal is to guide qualified leads to click the primary WhatsApp button on the webpage UI. If a user wants to book, purchase, hire, or request pricing, politely guide them to use the WhatsApp link/button provided on the screen. Do not simulate a checkout or payment process.\n" +
        "3. NO FAKE LINK GENERATION: Never invent URLs or predict image/video paths. If a user asks to see a project, describe it conceptually based on the context provided, and tell them to look at the portfolio section on the page.\n" +
        "4. BRIEF RESPONSES: Keep answers under 3 sentences where possible to fit neatly inside a standard web chat widget without causing layout shifts.\n\n" +
        "Tone and Profile:\n" +
        "- Professional, warm, helpful, concise, and incredibly engaging.\n" +
        "- Focus on warm minimalism, natural raw textures, creams, charcoals, emerald highlights, spatial luxury.\n" +
        "- Avoid excessive exclamation marks, cheesy marketing terminology, and AI self-reference.";

      // Structure chat contents
      const contents: any[] = [];
      if (Array.isArray(history)) {
        for (const turn of history) {
          if (turn.role === "user" || turn.role === "model") {
            contents.push({
              role: turn.role,
              parts: [{ text: turn.text || "" }]
            });
          }
        }
      }
      // Add current message
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const aiText = response.text?.trim() || "";

      return res.json({
        success: true,
        text: aiText,
        isSimulated: false
      });
    } catch (error: any) {
      console.error("Gemini portfolio chat failure:", error);
      return res.status(500).json({ error: error.message || "Failed to process chat message" });
    }
  });

  // Dynamic Cloudinary Config API fallback
  app.get("/api/config/cloudinary", (req, res) => {
    const hasCustomCloud = !!(process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME);
    return res.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || "djwrpottl",
      uploadPreset: process.env.VITE_CLOUDINARY_UPLOAD_PRESET || (hasCustomCloud ? "" : "pamnim_preset")
    });
  });

  // Secure Cloudinary Media Upload Handler
  app.post("/api/media/upload", async (req, res) => {
    try {
      const { file, type, uploadPreset } = req.body;
      if (!file) {
        return res.status(400).json({ error: "Missing file data" });
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      // Lazy configuration check and graceful simulated fallback
      if (!cloudName || !apiKey || !apiSecret) {
        console.warn("Cloudinary is not fully configured. Using submitted image base64 directly or high-end video placeholders.");
        
        let simulatedUrl = "";
        if (type === "video") {
          // Curated luxury interior video walkthroughs
          const randomVideos = [
            "https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-living-room-with-cozy-furniture-41551-large.mp4",
            "https://assets.mixkit.co/videos/preview/mixkit-interior-of-a-modern-living-room-41549-large.mp4"
          ];
          simulatedUrl = randomVideos[Math.floor(Math.random() * randomVideos.length)];
        } else if (typeof file === "string" && file.startsWith("data:image/")) {
          // Robust real-media bypass: return the actual uploaded image as base64 so it displays in real-time!
          simulatedUrl = file;
        } else {
          // Default Unsplash fallbacks
          const randomImages = [
            "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=2560&q=90",
            "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2560&q=90",
            "https://images.unsplash.com/photo-1616486038856-3c4852afcc3c?auto=format&fit=crop&w=2560&q=90",
            "https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=2560&q=90"
          ];
          simulatedUrl = randomImages[Math.floor(Math.random() * randomImages.length)];
        }

        return res.json({
          success: true,
          url: simulatedUrl,
          isSimulated: true,
          message: "Simulated Cloudinary upload. Add your CLOUDINARY secrets to .env to upload real custom files."
        });
      }

      const timestamp = Math.round(new Date().getTime() / 1000);
      const resourceType = type === "video" ? "video" : "image";

      const hasCustomCloud = !!(process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME);
      const actualPreset = process.env.VITE_CLOUDINARY_UPLOAD_PRESET || (uploadPreset === "pamnim_preset" && hasCustomCloud ? "" : uploadPreset);

      // Build parameters for signature
      const paramsToSign: Record<string, any> = {
        timestamp: timestamp,
      };

      if (actualPreset) {
        paramsToSign.upload_preset = actualPreset;
      }

      const sortedKeys = Object.keys(paramsToSign).sort() as Array<keyof typeof paramsToSign>;
      const sortedString = sortedKeys.map(key => `${key}=${paramsToSign[key]}`).join("&");
      const signature = crypto
        .createHash("sha1")
        .update(sortedString + apiSecret)
        .digest("hex");

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

      // Perform a clean, reliable, modern FormData request to Cloudinary's upload API
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("timestamp", String(timestamp));
      uploadFormData.append("api_key", apiKey);
      uploadFormData.append("signature", signature);
      if (actualPreset) {
        uploadFormData.append("upload_preset", actualPreset);
      }

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: uploadFormData
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Cloudinary API failure:", errText);
        throw new Error(`Cloudinary responded with ${response.status}: ${errText}`);
      }

      const responseData: any = await response.json();
      let secureUrl = responseData.secure_url || responseData.url;

      // STRICT MEDIA POLICY: Enforce q_auto:best,f_auto transformation for automatic formatting and compression
      if (secureUrl) {
        if (type === "video") {
          secureUrl = secureUrl.replace("/video/upload/", "/video/upload/q_auto,f_auto/");
        } else {
          secureUrl = secureUrl.replace("/image/upload/", "/image/upload/q_auto:best,f_auto/");
        }
      }

      return res.json({
        success: true,
        url: secureUrl,
        public_id: responseData.public_id,
        isSimulated: false
      });
    } catch (error: any) {
      console.error("Secure upload handler error:", error);
      return res.status(500).json({ error: error.message || "Failed to process media file upload" });
    }
  });

  // Pre-render helper for Services routes (SEO pre-rendering / SSR)
  function preRenderServices(urlPath: string): string {
    const pathParts = decodeURIComponent(urlPath).split("/").filter(Boolean);
    if (pathParts[0] !== "services") {
      return "";
    }

    const serverCategories = [
      {
        id: "interior-architecture",
        title: "Interior Architecture & Space Planning",
        description: "Architectural integrity meets elegant spatial design. We optimize layouts for flawless daily flow, design sculptural gypsum ceiling works, and craft highly efficient culinary kitchens.",
        accent: "01",
        items: [
          {
            name: "Space Planning",
            slug: "space-planning",
            desc: "Intelligent layout plans maximizing usable square footage with premium functional flow, custom furniture positioning, and architectural flow guides."
          },
          {
            name: "Kitchen Planning",
            slug: "kitchen-planning",
            desc: "Expert zoning, appliance integration, custom work triangle optimization, and ergonomic casework layout designed for elite homes."
          },
          {
            name: "Gypsum & Ceiling Works",
            slug: "gypsum-ceiling-works",
            desc: "Sculpted dry-wall ceilings, shadowline details, dropped acoustic plaster ceiling architectures, and integrated cove lighting pockets."
          }
        ]
      },
      {
        id: "bespoke-finishes",
        title: "Bespoke Finishes & Craftsmanship",
        description: "The fine surface and structural details that establish character and distinction. Custom architectural wainscoting, perfect joinery, and meticulously applied professional finishes.",
        accent: "02",
        items: [
          {
            name: "Wainscoting & Wall Paneling",
            slug: "wainscoting-wall-paneling",
            desc: "Elegant shaker paneling, classical raised-molding wainscots, modern fluted timber panel accents, and bespoke drywall detailing."
          },
          {
            name: "Cabinet Fittings & Joinery",
            slug: "cabinet-fittings-joinery",
            desc: "State-of-the-art kitchen cabinets, bespoke entry consoles, luxury walk-in wardrobes, and heavy wood custom bookcases with soft-close mechanisms."
          },
          {
            name: "Professional Painting",
            slug: "professional-painting",
            desc: "Pristine dustless surface preparation, seamless plaster skim coatings, premium eco-friendly matte finishes, and designer feature accent walls."
          }
        ]
      },
      {
        id: "premium-flooring",
        title: "Premium Flooring Solutions",
        description: "Premium foundations that support refined living. We fit pristine ceramic and porcelain tiling, sound-damped SPC/LVT boards, and seamless architectural epoxy coatings.",
        accent: "03",
        items: [
          {
            name: "Ceramic & Porcelain",
            slug: "ceramic-porcelain",
            desc: "Laser-aligned tile arrangements, custom-cut formats, elegant polished or honed tile surfaces, and masterfully applied uniform epoxy grout."
          },
          {
            name: "SPC & LVT Flooring",
            slug: "spc-lvt-flooring",
            desc: "Stone Plastic Composite and Luxury Vinyl Tile boards offering 100% water resistance, premium sound dampening underlays, and hyper-realistic wood designs."
          },
          {
            name: "Epoxy Coating",
            slug: "epoxy-coating",
            desc: "Ultra-sleek glossy residential garage coatings, seamless self-leveling industrial floors, and premium flake systems built for maximum wear resistance."
          }
        ]
      },
      {
        id: "lighting-textures-styling",
        title: "Lighting, Textures & Styling",
        description: "The sensory layering of light, fabric, and ambiance. Curated architectural lighting distributions, luxury drapery and blind systems, and immersive 3D simulations of your future home.",
        accent: "04",
        items: [
          {
            name: "Architectural Lighting",
            slug: "architectural-lighting",
            desc: "Carefully positioned glare-free recessed cans, ambient LED strip placements, focus-accent spot tracks, and statement designer pendants."
          },
          {
            name: "Curtain Works & Blinds",
            slug: "curtain-works-blinds",
            desc: "Custom double-track sheer and motorized blackout drapery, textured Roman blinds, and premium architectural roller sunscreen fabrics."
          },
          {
            name: "Consultation & 3D Visualization",
            slug: "consultation-3d-visualization",
            desc: "Full-color photorealistic interior walkthroughs, finish selection guides, customized digital mood boards, and live design workshops."
          }
        ]
      }
    ];

    const staticHeader = `
      <header class="fixed top-0 left-0 right-0 z-50 bg-cream/80 backdrop-blur-md border-b border-charcoal/5">
        <div class="max-w-7xl mx-auto px-6 md:px-12 h-24 flex items-center justify-between">
          <a href="/" class="flex items-center gap-2">
            <span class="font-serif text-2xl font-semibold tracking-wider text-charcoal">PAMNIM</span>
          </a>
          <nav class="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-charcoal/60">
            <a href="/" class="hover:text-charcoal transition-colors">Home</a>
            <a href="/portfolio" class="hover:text-charcoal transition-colors">Portfolio</a>
            <a href="/services" class="text-ochre">Services</a>
            <a href="/contact" class="hover:text-charcoal transition-colors">Contact</a>
          </nav>
        </div>
      </header>
    `;

    const staticFooter = `
      <footer class="bg-charcoal text-white pt-20 pb-10 border-t border-white/5">
        <div class="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div>
            <span class="font-serif text-2xl font-bold tracking-wider text-white block mb-6">PAMNIM</span>
            <p class="text-sm text-white/50 leading-relaxed max-w-xs">
              Luxury interior architecture and custom finishes crafted with warm minimalism.
            </p>
          </div>
        </div>
        <div class="max-w-7xl mx-auto px-6 md:px-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-white/30">
          <p>&copy; 2026 Pamnim Interiors. All rights reserved.</p>
        </div>
      </footer>
    `;

    // A) /services Page
    if (pathParts.length === 1) {
      let cardsHtml = "";
      for (const cat of serverCategories) {
        cardsHtml += `
          <div class="bg-white border border-charcoal/5 rounded-[2.5rem] p-8 md:p-12 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-center mb-8">
                <span class="font-mono text-sm tracking-widest text-ochre font-extrabold">${cat.accent}</span>
              </div>
              <h2 class="text-2xl md:text-3xl font-serif font-medium text-charcoal mb-4">${cat.title}</h2>
              <p class="text-charcoal/60 text-sm leading-relaxed mb-8">${cat.description}</p>
            </div>
            <a href="/services/${cat.id}" class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-charcoal hover:text-ochre transition-colors">
              View Category →
            </a>
          </div>
        `;
      }

      return `
        <div class="min-h-screen bg-cream flex flex-col justify-between">
          <div>
            ${staticHeader}
            <section class="pt-28 sm:pt-36 pb-12 sm:pb-16 relative overflow-hidden bg-cream border-b border-charcoal/5">
              <div class="max-w-7xl mx-auto px-6 md:px-12 relative z-10 text-center">
                <span class="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-4 block">OUR CORE DISCIPLINES</span>
                <h1 class="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-serif text-charcoal font-medium mb-6 leading-tight max-w-4xl mx-auto">
                  Refined Services & <span class="italic font-light">Elevated Architecture</span>
                </h1>
                <p class="text-sm sm:text-base md:text-lg lg:text-xl text-charcoal/60 max-w-2xl mx-auto leading-relaxed">
                  Experience our comprehensive design spectrum, carefully structured to assure pristine finish quality and warm minimalist sophistication.
                </p>
              </div>
            </section>
            <main class="py-20 max-w-7xl mx-auto px-6 md:px-12">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                ${cardsHtml}
              </div>
            </main>
          </div>
          ${staticFooter}
        </div>
      `;
    }

    // B) /services/[categoryId] Page
    if (pathParts.length === 2) {
      const catId = pathParts[1];
      const cat = serverCategories.find(c => c.id === catId);
      if (!cat) return "";

      let subcardsHtml = "";
      for (const item of cat.items) {
        subcardsHtml += `
          <div class="bg-white border border-charcoal/5 rounded-[2rem] p-8 shadow-sm flex flex-col justify-between">
            <div>
              <h3 class="text-xl font-bold text-charcoal mb-4">${item.name}</h3>
              <p class="text-charcoal/50 text-sm leading-relaxed mb-8">${item.desc}</p>
            </div>
            <a href="/services/${cat.id}/${item.slug}" class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-charcoal hover:text-ochre transition-colors">
              Explore Details →
            </a>
          </div>
        `;
      }

      return `
        <div class="min-h-screen bg-cream flex flex-col justify-between">
          <div>
            ${staticHeader}
            <div class="pt-32 pb-4 bg-cream border-b border-charcoal/5">
              <div class="max-w-7xl mx-auto px-6 md:px-12 flex items-center gap-2 text-xs font-mono text-charcoal/40">
                <a href="/services" class="hover:text-ochre">Services</a>
                <span>&gt;</span>
                <span class="text-ochre font-medium">${cat.title}</span>
              </div>
            </div>
            <section class="py-16 relative overflow-hidden bg-cream border-b border-charcoal/5">
              <div class="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
                <span class="font-mono text-xs tracking-widest text-ochre font-extrabold uppercase mb-2 block">Category ${cat.accent}</span>
                <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif text-charcoal font-medium mb-6 leading-tight max-w-4xl">${cat.title}</h1>
                <p class="text-sm sm:text-base md:text-lg text-charcoal/60 max-w-3xl leading-relaxed">${cat.description}</p>
              </div>
            </section>
            <main class="py-20 max-w-7xl mx-auto px-6 md:px-12">
              <h2 class="text-xs font-bold tracking-[0.2em] text-charcoal/30 uppercase mb-8 pb-4 border-b border-charcoal/5">DETAILED SERVICE BREAKDOWN</h2>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                ${subcardsHtml}
              </div>
            </main>
            <section class="py-16 bg-cream border-t border-charcoal/5">
              <div class="max-w-5xl mx-auto px-6 md:px-12">
                <div class="bg-charcoal text-white rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden border border-white/5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
                  <div class="relative z-10 space-y-3 text-center md:text-left max-w-2xl">
                    <span class="text-[10px] font-bold tracking-[0.2em] text-ochre uppercase block">READY TO START?</span>
                    <h3 class="text-2xl md:text-3xl font-serif font-medium leading-tight text-white">Discuss your <span class="italic font-light text-ochre-light">${cat.title}</span> project</h3>
                    <p class="text-white/60 text-xs leading-relaxed">Connect with our design advisors today. We'll map out your structural planning and spatial options without any obligation.</p>
                  </div>
                  <div class="relative z-10 flex-shrink-0 w-full md:w-auto">
                    <a href="/contact" class="w-full md:w-auto bg-ochre hover:bg-ochre/90 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 text-sm">
                      Get a Quote
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </div>
          ${staticFooter}
        </div>
      `;
    }

    // C) /services/[categoryId]/[serviceSlug] Page
    if (pathParts.length === 3) {
      const catId = pathParts[1];
      const serviceSlug = pathParts[2];
      const cat = serverCategories.find(c => c.id === catId);
      if (!cat) return "";

      const service = cat.items.find(s => s.slug === serviceSlug);
      if (!service) return "";

      let placeholderGallery = "";
      for (let i = 1; i <= 3; i++) {
        placeholderGallery += `
          <div class="aspect-[4/3] rounded-[2rem] border-2 border-dashed border-charcoal/10 bg-white/40 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            <p class="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">Photos coming soon</p>
            <p class="text-[11px] text-charcoal/30 max-w-[180px]">Aesthetic portfolio updates and luxury lookbook renders are currently in progress.</p>
          </div>
        `;
      }

      return `
        <div class="min-h-screen bg-cream flex flex-col justify-between">
          <div>
            ${staticHeader}
            <div class="pt-32 pb-4 bg-cream border-b border-charcoal/5">
              <div class="max-w-7xl mx-auto px-6 md:px-12 flex items-center gap-2 text-xs font-mono text-charcoal/40">
                <a href="/services" class="hover:text-ochre">Services</a>
                <span>&gt;</span>
                <a href="/services/${cat.id}" class="hover:text-ochre">${cat.title}</a>
                <span>&gt;</span>
                <span class="text-ochre font-medium">${service.name}</span>
              </div>
            </div>
            <main class="py-16 max-w-7xl mx-auto px-6 md:px-12">
              <div class="max-w-4xl">
                <span class="text-xs font-bold tracking-[0.2em] text-ochre uppercase mb-3 block">DETAILED SERVICE STUDY</span>
                <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif text-charcoal font-medium mb-6 leading-tight">${service.name}</h1>
                <p class="text-base sm:text-lg md:text-xl text-charcoal/60 leading-relaxed font-sans mb-12">${service.desc}</p>
              </div>
              <div class="mt-12 space-y-6">
                <h3 class="text-xs font-bold tracking-[0.2em] text-charcoal/30 uppercase pb-3 border-b border-charcoal/5">PROJECT PORTFOLIO LOOKBOOK</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  ${placeholderGallery}
                </div>
              </div>
            </main>
            <section class="py-20 bg-cream">
              <div class="max-w-5xl mx-auto px-6 md:px-12 text-center">
                <div class="bg-charcoal text-white rounded-[3rem] p-10 md:p-16 relative overflow-hidden border border-white/5 shadow-2xl">
                  <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-ochre to-transparent opacity-50"></div>
                  <div class="relative z-10 space-y-6">
                    <span class="text-xs font-bold tracking-[0.2em] text-ochre uppercase block">TAILORED HOME SERVICE</span>
                    <h2 class="text-3xl md:text-4xl lg:text-5xl font-serif font-medium leading-tight max-w-2xl mx-auto">Bring <span class="italic font-light text-ochre-light">${service.name}</span> to your residence</h2>
                    <p class="text-white/60 text-sm md:text-base max-w-xl mx-auto leading-relaxed">Every home deserves architectural precision. Speak with our experts to discuss custom scheduling, design coordination, and direct material options.</p>
                    <div class="pt-6 flex justify-center">
                      <a href="/contact" class="w-full sm:w-auto bg-ochre hover:bg-ochre/90 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-ochre/20">
                        Get a Quote
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
          ${staticFooter}
        </div>
      `;
    }

    return "";
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Explicit catch-all SPA route with Vite HTML transform for dev mode
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith("/api") || url.includes(".")) {
        return next();
      }
      try {
        const fs = await import("fs");
        let template = fs.readFileSync(
          path.resolve(process.cwd(), "index.html"),
          "utf-8"
        );
        template = await vite.transformIndexHtml(url, template);
        
        // Static pre-rendering inject
        const preRendered = preRenderServices(req.path);
        if (preRendered) {
          template = template.replace('<div id="root"></div>', `<div id="root">${preRendered}</div>`);
        }

        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", async (req, res) => {
      try {
        const fs = await import("fs");
        let template = fs.readFileSync(
          path.join(distPath, "index.html"),
          "utf-8"
        );
        
        // Static pre-rendering inject
        const preRendered = preRenderServices(req.path);
        if (preRendered) {
          template = template.replace('<div id="root"></div>', `<div id="root">${preRendered}</div>`);
        }

        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        res.sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
