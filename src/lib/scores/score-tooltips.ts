export interface ScoreTooltipContent {
  title: string;
  calculation: string;
  importance: string;
}

export const SCORE_TOOLTIPS = {
  overall: {
    title: "Reputation Boost Score",
    calculation:
      "70% Profile strength + 30% Ranking outcome, blended into one 0–100 score. Grades: Healthy 70+, At risk 40–69, Urgent below 40.",
    importance:
      "Your headline health check — combines what you can control on your listing with where you actually rank, so you know if Google is sending you customers.",
  },
  profileStrength: {
    title: "Profile strength",
    calculation:
      "Reviews (rating and volume vs competitors), profile completeness, photos and videos, post recency, review response rate, keyword relevance, and notifications — weighted into one 0–100 score.",
    importance:
      "These are signals you control directly on your Google Business Profile. A stronger profile helps Google trust and recommend your business.",
  },
  rankingOutcome: {
    title: "Ranking outcome",
    calculation: "60% Visibility + 40% Revenue capture, combined into one 0–100 score.",
    importance:
      "Reflects real search results today — how often you show up in the Local 3-Pack and how much of the available map traffic you capture.",
  },
  visibility: {
    title: "Visibility",
    calculation:
      "Impression-weighted average across your keywords: sampled top-three coverage and median Places visibility at 1, 3, and 5 miles from the business.",
    importance:
      "Measures discoverability. Customers can't call or visit if your listing doesn't appear when they search nearby.",
  },
  revenueCapture: {
    title: "Revenue capture",
    calculation:
      "Impression-weighted click-share by pack position across your service area — #1 captures the most map clicks, #2 and #3 less, and positions outside the pack capture very little.",
    importance:
      "Estimates how much of the available map demand you're winning. Moving up one pack position can meaningfully increase calls and directions.",
  },
  relevance: {
    title: "Relevance",
    calculation:
      "How well your categories, services, description, attributes, and reviews align with this keyword compared to what Google expects for the search.",
    importance:
      "Google favors listings that clearly match the search. Low relevance means profile edits may help even before rank changes.",
  },
  grade: {
    title: "Score grade",
    calculation: "Based on your Reputation Boost Score: Healthy 70–100, At risk 40–69, Urgent 0–39.",
    importance:
      "Shows how urgently to act. Below 70, competitors are likely capturing map searches you should be winning.",
  },
  scoreDelta: {
    title: "Score change",
    calculation:
      "Change in your overall Reputation Boost Score compared to your previous audit.",
    importance:
      "Tracks whether recent work on your profile and rankings is moving the needle over time.",
  },
  demandAlignment: {
    title: "Keyword demand alignment",
    calculation:
      "Share of tracked keywords that match measurable GBP search-term demand, blended into Visibility (15% weight).",
    importance:
      "Ranking for keywords nobody searches wastes tracking budget. Aligning with real demand improves score accuracy and weekly grid focus.",
  },
  serviceAreaCoverage: {
    title: "Service area coverage",
    calculation:
      "Average radial coverage across your tracked keywords — the share of measured locations where you appear in the first three Places results.",
    importance:
      "Shows geographic strength beyond your business pin. Weak zones are opportunities to improve rankings in neighborhoods you serve.",
  },
} as const satisfies Record<string, ScoreTooltipContent>;
