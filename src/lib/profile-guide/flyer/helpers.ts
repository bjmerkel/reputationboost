export function applyPromptRefinement(basePrompt: string, refinement?: string | null): string {
  const trimmed = refinement?.trim();
  if (!trimmed) return basePrompt;
  return `${basePrompt} Additional creative direction: ${trimmed}`;
}

export function bufferToDataUrl(buffer: Buffer, mimeType = "image/png"): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) {
    throw new Error("Invalid image data URL");
  }
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}
