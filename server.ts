import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    return res.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || "djwrpottl",
      uploadPreset: process.env.VITE_CLOUDINARY_UPLOAD_PRESET || "pamnim_preset"
    });
  });

  // Secure Cloudinary Media Upload Handler
  app.post("/api/media/upload", async (req, res) => {
    try {
      const { file, type, uploadPreset } = req.body;
      if (!file) {
        return res.status(400).json({ error: "Missing file data" });
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      // Lazy configuration check and graceful simulated fallback
      if (!cloudName || !apiKey || !apiSecret) {
        console.warn("Cloudinary is not fully configured. Using highly curated luxury placeholders for testing.");
        
        let simulatedUrl = "";
        if (type === "video") {
          // Curated luxury interior video walkthroughs
          const randomVideos = [
            "https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-living-room-with-cozy-furniture-41551-large.mp4",
            "https://assets.mixkit.co/videos/preview/mixkit-interior-of-a-modern-living-room-41549-large.mp4"
          ];
          simulatedUrl = randomVideos[Math.floor(Math.random() * randomVideos.length)];
        } else {
          // Curated luxury interior images
          const randomImages = [
            "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1616486038856-3c4852afcc3c?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=1200&q=80"
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

      // Build parameters for signature
      const paramsToSign: Record<string, any> = {
        timestamp: timestamp,
      };

      if (uploadPreset) {
        paramsToSign.upload_preset = uploadPreset;
      }

      const sortedKeys = Object.keys(paramsToSign).sort() as Array<keyof typeof paramsToSign>;
      const sortedString = sortedKeys.map(key => `${key}=${paramsToSign[key]}`).join("&");
      const signature = crypto
        .createHash("sha1")
        .update(sortedString + apiSecret)
        .digest("hex");

      // Construct payload
      const formData = new FormData();
      formData.append("file", file); // Supports base64 DataURI natively
      formData.append("timestamp", String(timestamp));
      formData.append("api_key", apiKey);
      formData.append("signature", signature);

      if (uploadPreset) {
        formData.append("upload_preset", uploadPreset);
      }

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Cloudinary API failure:", errText);
        throw new Error(`Cloudinary responded with ${response.status}: ${errText}`);
      }

      const responseData: any = await response.json();
      let secureUrl = responseData.secure_url || responseData.url;

      // STRICT MEDIA POLICY: Enforce q_auto,f_auto transformation for automatic formatting and compression
      if (secureUrl) {
        if (type === "video") {
          secureUrl = secureUrl.replace("/video/upload/", "/video/upload/q_auto,f_auto/");
        } else {
          secureUrl = secureUrl.replace("/image/upload/", "/image/upload/q_auto,f_auto/");
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
