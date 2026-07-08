export interface ReviewResponseKeywordWeave {
  suggestedKeyword: string | null;
  keywordsHit: string[];
  weaveSkipped: boolean;
  weaveReason: string | null;
  activeCampaignKeyword?: string | null;
}

export interface ReviewResponseDraft {
  reviewId: string;
  rating: number;
  response: string;
  keywordWeave?: ReviewResponseKeywordWeave;
}
