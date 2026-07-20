import { Compass, Layers, Grid, Sparkles, LucideIcon } from 'lucide-react';

export interface ServiceItem {
  name: string;
  slug: string;
  desc: string;
  heroImage?: string;
  images?: string[];
}

export interface ServiceCategory {
  id: string;
  title: string;
  description: string;
  items: ServiceItem[];
  icon: LucideIcon;
  accent: string;
}

export const serviceCategories: ServiceCategory[] = [
  {
    id: "interior-architecture",
    title: "Interior Architecture & Space Planning",
    description: "Architectural integrity meets elegant spatial design. We optimize layouts for flawless daily flow, design sculptural gypsum ceiling works, and craft highly efficient culinary kitchens.",
    icon: Compass,
    accent: "01",
    items: [
      {
        name: "Space Planning",
        slug: "space-planning",
        desc: "Intelligent layout plans maximizing usable square footage with premium functional flow, custom furniture positioning, and architectural flow guides.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Kitchen Planning",
        slug: "kitchen-planning",
        desc: "Expert zoning, appliance integration, custom work triangle optimization, and ergonomic casework layout designed for elite homes.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Gypsum & Ceiling Works",
        slug: "gypsum-ceiling-works",
        desc: "Sculpted dry-wall ceilings, shadowline details, dropped acoustic plaster ceiling architectures, and integrated cove lighting pockets.",
        heroImage: "",
        images: ["", "", ""]
      }
    ]
  },
  {
    id: "bespoke-finishes",
    title: "Bespoke Finishes & Craftsmanship",
    description: "The fine surface and structural details that establish character and distinction. Custom architectural wainscoting, perfect joinery, and meticulously applied professional finishes.",
    icon: Layers,
    accent: "02",
    items: [
      {
        name: "Wainscoting & Wall Paneling",
        slug: "wainscoting-wall-paneling",
        desc: "Elegant shaker paneling, classical raised-molding wainscots, modern fluted timber panel accents, and bespoke drywall detailing.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Cabinet Fittings & Joinery",
        slug: "cabinet-fittings-joinery",
        desc: "State-of-the-art kitchen cabinets, bespoke entry consoles, luxury walk-in wardrobes, and heavy wood custom bookcases with soft-close mechanisms.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Professional Painting",
        slug: "professional-painting",
        desc: "Pristine dustless surface preparation, seamless plaster skim coatings, premium eco-friendly matte finishes, and designer feature accent walls.",
        heroImage: "",
        images: ["", "", ""]
      }
    ]
  },
  {
    id: "premium-flooring",
    title: "Premium Flooring Solutions",
    description: "Premium foundations that support refined living. We fit pristine ceramic and porcelain tiling, sound-damped SPC/LVT boards, and seamless architectural epoxy coatings.",
    icon: Grid,
    accent: "03",
    items: [
      {
        name: "Ceramic & Porcelain",
        slug: "ceramic-porcelain",
        desc: "Laser-aligned tile arrangements, custom-cut formats, elegant polished or honed tile surfaces, and masterfully applied uniform epoxy grout.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "SPC & LVT Flooring",
        slug: "spc-lvt-flooring",
        desc: "Stone Plastic Composite and Luxury Vinyl Tile boards offering 100% water resistance, premium sound dampening underlays, and hyper-realistic wood designs.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Epoxy Coating",
        slug: "epoxy-coating",
        desc: "Ultra-sleek glossy residential garage coatings, seamless self-leveling industrial floors, and premium flake systems built for maximum wear resistance.",
        heroImage: "",
        images: ["", "", ""]
      }
    ]
  },
  {
    id: "lighting-textures-styling",
    title: "Lighting, Textures & Styling",
    description: "The sensory layering of light, fabric, and ambiance. Curated architectural lighting distributions, luxury drapery and blind systems, and immersive 3D simulations of your future home.",
    icon: Sparkles,
    accent: "04",
    items: [
      {
        name: "Architectural Lighting",
        slug: "architectural-lighting",
        desc: "Carefully positioned glare-free recessed cans, ambient LED strip placements, focus-accent spot tracks, and statement designer pendants.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Curtain Works & Blinds",
        slug: "curtain-works-blinds",
        desc: "Custom double-track sheer and motorized blackout drapery, textured Roman blinds, and premium architectural roller sunscreen fabrics.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Consultation & 3D Visualization",
        slug: "consultation-3d-visualization",
        desc: "Full-color photorealistic interior walkthroughs, finish selection guides, customized digital mood boards, and live design workshops.",
        heroImage: "",
        images: ["", "", ""]
      }
    ]
  }
];
