export interface ReviewResponseKeywordWeave {
  suggestedKeyword: string | null;
  keywordsHit: string[];
  weaveSkipped: boolean;
  weaveReason: string | null;
}
