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
  extras: readonly string[];
  gradient: string;
  popular?: boolean;
};

export const pricingPlans: PricingPlan[] = [
  {
    id: "keyword",
    name: "Keyword Plan",
    price: 150,
    description:
      "Everything you need to optimize your Google Business Profile and climb Google Maps rankings.",
    extras: [],
    gradient: "from-slate-600 to-slate-700",
  },
  {
    id: "omni",
    name: "Omni Plan",
    price: 199,
    description:
      "Full GBP optimization plus social media content to grow visibility across channels.",
    popular: true,
    extras: [
      "Social Media Content Creation",
      "Social Media Posts to Facebook and Instagram 1x per week",
    ],
    gradient: "from-emerald-500 to-cyan-500",
  },
  {
    id: "spectrum",
    name: "Spectrum Plan",
    price: 399,
    description:
      "Our most comprehensive plan with aggressive social posting and review protection.",
    extras: [
      "Social Media Content Creation",
      "Social Media Posts to Facebook and Instagram 3x per week",
      "Dispute Negative Reviews",
    ],
    gradient: "from-violet-500 to-purple-600",
  },
];
