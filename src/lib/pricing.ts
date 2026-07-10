export const baseFeatures = [
  "Keyword Consultation",
  "Customized AI Strategy Guide",
  "Google Business Profile Optimization Tools",
  "Google Posts",
  "Data Analysis & Visualization",
  "Automated AI Review Responder",
  "Canned Review Responder",
  "Profile Guide and QR Code",
  "Text and Email Survey",
  "Dedicated Account Manager",
  "Google Place Verification",
] as const;

export type PricingPlan = {
  id: string;
  name: string;
  price: number;
  description: string;
  /** Key bullets shown on homepage pricing cards */
  highlights: readonly string[];
  /** Additional features vs lower tiers */
  extras: readonly string[];
  gradient: string;
  popular?: boolean;
};

export const pricingPlans: PricingPlan[] = [
  {
    id: "keyword",
    name: "Keyword Plan",
    price: 150,
    description: "Manage your own Google Business Profile with AI guidance.",
    highlights: [
      "Score audit — updated every night",
      "AI-built action plan for your Google listing",
      "Track where you rank across your whole service area",
      "Google listing tools — posts, reviews, photos",
      "Dedicated account manager",
    ],
    extras: [],
    gradient: "from-slate-600 to-slate-700",
  },
  {
    id: "omni",
    name: "Omni Plan",
    price: 199,
    description: "Add ongoing social content to strengthen local visibility.",
    popular: true,
    highlights: [
      "Score audit — updated every night",
      "AI-built action plan for your Google listing",
      "Track where you rank across your whole service area",
      "Google listing tools — posts, reviews, photos",
      "Dedicated account manager",
    ],
    extras: [
      "Social media content creation",
      "Facebook & Instagram posts 1× per week",
    ],
    gradient: "from-emerald-500 to-cyan-500",
  },
  {
    id: "spectrum",
    name: "Spectrum Plan",
    price: 399,
    description: "Fully managed local visibility with review protection.",
    highlights: [
      "Score audit — updated every night",
      "AI-built action plan for your Google listing",
      "Track where you rank across your whole service area",
      "Google listing tools — posts, reviews, photos",
      "Dedicated account manager",
    ],
    extras: [
      "Social media content creation",
      "Facebook & Instagram posts 3× per week",
      "Flag & escalate policy-violating reviews",
    ],
    gradient: "from-violet-500 to-purple-600",
  },
];
