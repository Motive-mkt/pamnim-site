import { Compass, Layers, Grid, Lightbulb, LucideIcon } from 'lucide-react';

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
    title: "Space planning and layouts",
    description: "How a home works matters as much as how it looks. We plan layouts for easy daily movement, design gypsum ceilings and feature walls, and lay out kitchens that are comfortable to cook in.",
    icon: Compass,
    accent: "01",
    items: [
      {
        name: "Space Planning",
        slug: "space-planning",
        desc: "Room-by-room layouts that make the most of your floor area, with furniture positioned for comfortable movement and clear sight lines.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Kitchen Planning",
        slug: "kitchen-planning",
        desc: "Kitchen layouts built around how you cook: work zones, appliance placement, storage and counter space planned together.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Gypsum & Ceiling Works",
        slug: "gypsum-ceiling-works",
        desc: "Gypsum ceilings with shadow-line details, dropped sections and concealed pockets for cove lighting.",
        heroImage: "",
        images: ["", "", ""]
      }
    ]
  },
  {
    id: "bespoke-finishes",
    title: "Finishes and custom carpentry",
    description: "Paneling, joinery and paintwork made to measure and finished cleanly. These are the details people notice every day.",
    icon: Layers,
    accent: "02",
    items: [
      {
        name: "Wainscoting & Wall Paneling",
        slug: "wainscoting-wall-paneling",
        desc: "Shaker and raised-molding wainscoting, fluted timber panels and detailed drywall feature walls.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Cabinet Fittings & Joinery",
        slug: "cabinet-fittings-joinery",
        desc: "Kitchen cabinets, entry consoles, walk-in wardrobes and bookcases, built to measure with soft-close fittings.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Professional Painting",
        slug: "professional-painting",
        desc: "Dust-controlled surface preparation, smooth plaster skim coats, low-odour matte finishes and feature walls.",
        heroImage: "",
        images: ["", "", ""]
      }
    ]
  },
  {
    id: "premium-flooring",
    title: "Flooring",
    description: "A good floor is a good foundation for the rest of the room. We fit ceramic and porcelain tile, SPC and vinyl boards, and epoxy coatings.",
    icon: Grid,
    accent: "03",
    items: [
      {
        name: "Ceramic & Porcelain",
        slug: "ceramic-porcelain",
        desc: "Precisely aligned tile layouts, custom-cut formats in polished or honed finishes, and even, clean grout lines.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "SPC & LVT Flooring",
        slug: "spc-lvt-flooring",
        desc: "Stone plastic composite and luxury vinyl boards that are fully water resistant, quiet underfoot and available in realistic wood finishes.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Epoxy Coating",
        slug: "epoxy-coating",
        desc: "Glossy garage floors, seamless self-levelling floors and flake systems made for heavy wear.",
        heroImage: "",
        images: ["", "", ""]
      }
    ]
  },
  {
    id: "lighting-textures-styling",
    title: "Lighting, curtains and styling",
    description: "Light, fabric and finishing touches set the mood of a room. We plan lighting, make curtains and blinds, and show you the result in 3D before work starts.",
    icon: Lightbulb,
    accent: "04",
    items: [
      {
        name: "Architectural Lighting",
        slug: "architectural-lighting",
        desc: "Recessed lights placed to avoid glare, LED strips, accent spots and statement pendants, planned as one scheme.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Curtain Works & Blinds",
        slug: "curtain-works-blinds",
        desc: "Double-track sheer and blackout curtains, motorised options, Roman blinds and roller sunscreen fabrics.",
        heroImage: "",
        images: ["", "", ""]
      },
      {
        name: "Consultation & 3D Visualization",
        slug: "consultation-3d-visualization",
        desc: "Realistic 3D views of your finished rooms, finish selection guides, mood boards and design workshops with our team.",
        heroImage: "",
        images: ["", "", ""]
      }
    ]
  }
];
