import type { FullAuditPayload } from "@/audit/types";
import type { GbpMediaCategory } from "@/lib/google/gbp-media";
import { buildAuditContext } from "./audit-context";
import { completeJson } from "./client";
import { getOpenAiApiKey, getOpenAiImageModel, isImageGenerationConfigured } from "./config";

export interface GbpPhotoJob {
  title: string;
  category: GbpMediaCategory;
  hint: string;
  /** DALL-E prompt — generated on execute when set. */
  imagePrompt?: string;
  aiGenerated?: boolean;
}

const AI_ELIGIBLE_CATEGORIES = new Set<GbpMediaCategory>([
  "AT_WORK",
  "ADDITIONAL",
  "PRODUCT",
  "TEAMS",
]);

export function isAiPhotoCategory(category: GbpMediaCategory): boolean {
  return AI_ELIGIBLE_CATEGORIES.has(category);
}

function cityFromAudit(audit: FullAuditPayload): string {
  return audit.gbp.identity.address.split(",").slice(-2, -1)[0]?.trim() ?? "the local area";
}

/** Fallback photo jobs when OpenAI is not configured. */
export function buildTemplatePhotoJobs(audit: FullAuditPayload): GbpPhotoJob[] {
  const city = cityFromAudit(audit);
  const category = audit.gbp.identity.primaryCategory;

  return [
    {
      title: "Exterior & storefront",
      category: "EXTERIOR",
      hint: `Upload a real wide shot of your storefront or entrance in ${city}. AI cannot replace this — use your own photo.`,
      aiGenerated: false,
    },
    {
      title: "Interior & team",
      category: "INTERIOR",
      hint: "Upload a real interior, showroom, or team photo. Use your own camera — builds the most trust.",
      aiGenerated: false,
    },
    {
      title: "At work / service",
      category: "AT_WORK",
      hint: `Staff delivering ${category} — professional service-in-action shot.`,
      aiGenerated: false,
    },
    ...audit.rankings.keywords.slice(0, 4).map((kw) => ({
      title: `Service photo: ${kw.keyword}`,
      category: "ADDITIONAL" as GbpMediaCategory,
      hint: `Showcase "${kw.keyword}" for ${city} customers.`,
      aiGenerated: false,
    })),
  ];
}

const PHOTO_PROMPT_SYSTEM = `You write DALL-E 3 prompts for Google Business Profile marketing photos.

Rules:
- Photorealistic professional commercial photography — looks like a skilled local photographer shot it
- NO text overlays, logos, watermarks, or readable business signage with specific names
- NEVER invent a fake storefront or building facade for a named business (Google policy)
- Show believable service work: hands-on labor, equipment, vehicles, finished results, happy customers from behind/side angles
- Warm natural lighting, sharp subject focus, subtle depth of field
- Reflect the industry and regional context (climate, setting) without clichés
- Each imagePrompt is 2-4 vivid sentences DALL-E can render directly
- Only write imagePrompt for jobs where aiGenerated is true`;

export async function generateGbpPhotoJobsLlm(
  audit: FullAuditPayload
): Promise<GbpPhotoJob[]> {
  const template = buildTemplatePhotoJobs(audit);

  if (!isImageGenerationConfigured()) {
    return template;
  }

  const aiJobs = template.filter((j) => isAiPhotoCategory(j.category));
  if (aiJobs.length === 0) return template;

  try {
    const context = buildAuditContext(audit);
    const llm = await completeJson<{
      jobs?: Array<{ title?: string; imagePrompt?: string }>;
    }>(
      [
        { role: "system", content: PHOTO_PROMPT_SYSTEM },
        {
          role: "user",
          content: `Write DALL-E prompts for these GBP photo jobs. Match each title exactly.

BUSINESS CONTEXT:
${context}

JOBS NEEDING AI PROMPTS:
${JSON.stringify(
  aiJobs.map((j) => ({ title: j.title, category: j.category, hint: j.hint })),
  null,
  2
)}

Return JSON:
{
  "jobs": [
    { "title": "exact title from list", "imagePrompt": "detailed DALL-E prompt" }
  ]
}`,
        },
      ],
      { temperature: 0.7, maxTokens: 2000 }
    );

    const promptByTitle = new Map(
      (llm.jobs ?? [])
        .filter((j) => j.title && j.imagePrompt)
        .map((j) => [j.title!, j.imagePrompt!.trim()])
    );

    return template.map((job) => {
      if (!isAiPhotoCategory(job.category)) return job;
      const imagePrompt = promptByTitle.get(job.title);
      if (!imagePrompt) return job;
      return { ...job, imagePrompt, aiGenerated: true };
    });
  } catch (error) {
    console.error("[llm] GBP photo prompt generation failed:", error);
    return template;
  }
}

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  error?: { message?: string };
}

/** Generate a PNG/JPEG via OpenAI Images API — returns bytes for direct GBP upload. */
export async function generateGbpPhotoImage(
  prompt: string
): Promise<{ bytes: ArrayBuffer; contentType: string; revisedPrompt?: string }> {
  const key = getOpenAiApiKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");

  const model = getOpenAiImageModel();
  const isDalle3 = model.includes("dall-e");

  const body: Record<string, unknown> = {
    model,
    prompt: prompt.trim(),
    n: 1,
    size: "1024x1024",
    response_format: "b64_json",
  };

  if (isDalle3) {
    body.quality = "hd";
    body.style = "natural";
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as OpenAiImageResponse;
  const item = data.data?.[0];

  if (!res.ok || !item?.b64_json) {
    throw new Error(data.error?.message ?? `Image generation failed (${res.status})`);
  }

  const binary = Buffer.from(item.b64_json, "base64");
  return {
    bytes: binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength),
    contentType: "image/png",
    revisedPrompt: item.revised_prompt,
  };
}

export function photoJobDraftContent(job: GbpPhotoJob): string {
  if (job.aiGenerated && job.imagePrompt) {
    return [
      "AI-generated photo — will be created and uploaded to Google when you run this task.",
      "",
      `Scene: ${job.hint}`,
      `Category: ${job.category}`,
      "",
      "Image prompt:",
      job.imagePrompt,
    ].join("\n");
  }

  return [
    "Paste a public photo URL on the first line (https://…), then approve to upload.",
    "",
    job.hint,
    `Category: ${job.category}`,
  ].join("\n");
}
