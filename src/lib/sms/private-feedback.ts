export function buildPrivateFeedbackTemplate(businessName: string): string {
  return `Hi [FIRST_NAME], we're sorry your experience with ${businessName} wasn't great. Please tell us directly what happened so we can fix it: [REVIEW_LINK]`;
}
