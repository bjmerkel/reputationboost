import type { FullAuditPayload } from "@/audit/types";
import type { GbpMediaCategory } from "@/lib/google/gbp-media";
import { mediaCategoryLabel } from "@/lib/google/gbp-media-coverage";
import { buildAuditContext } from "./audit-context";
import { completeJson } from "./client";
import { getOpenAiApiKey, getOpenAiImageModel, isImageGenerationConfigured } from "./config";

export interface GbpPhotoJob {
  title: string;
  category: GbpMediaCategory;
  hint: string;
  /** Image prompt — generated on execute when set. */
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
  const missing = new Set(audit.gbp.content.mediaCoverage?.missingCategories ?? []);

  const jobs: GbpPhotoJob[] = [];

  const maybePush = (job: GbpPhotoJob) => {
    if (!missing.has(job.category)) return;
    jobs.push(job);
  };

  maybePush({
    title: "Exterior & storefront",
    category: "EXTERIOR",
    hint: `Upload a real wide shot of your storefront or entrance in ${city}. AI cannot replace this — use your own photo.`,
    aiGenerated: false,
  });
  maybePush({
    title: "Interior & team",
    category: "INTERIOR",
    hint: "Upload a real interior, showroom, or team photo. Use your own camera — builds the most trust.",
    aiGenerated: false,
  });
  maybePush({
    title: "At work / service",
    category: "AT_WORK",
    hint: `Staff delivering ${category} — professional service-in-action shot.`,
    aiGenerated: false,
  });
  maybePush({
    title: "Team photo",
    category: "TEAMS",
    hint: `Show your crew or staff serving ${city} customers.`,
    aiGenerated: false,
  });

  if (jobs.length === 0) {
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

  for (const missingCategory of missing) {
    if (jobs.some((job) => job.category === missingCategory)) continue;
    jobs.push({
      title: `${mediaCategoryLabel(missingCategory as GbpMediaCategory)} photo`,
      category: missingCategory as GbpMediaCategory,
      hint: `Add a ${mediaCategoryLabel(missingCategory as GbpMediaCategory).toLowerCase()} photo to round out your Google profile.`,
      aiGenerated: missingCategory === "AT_WORK" || missingCategory === "ADDITIONAL",
    });
  }

  jobs.push(
    ...audit.rankings.keywords.slice(0, Math.max(2, 4 - jobs.length)).map((kw) => ({
      title: `Service photo: ${kw.keyword}`,
      category: "ADDITIONAL" as GbpMediaCategory,
      hint: `Showcase "${kw.keyword}" for ${city} customers.`,
      aiGenerated: true,
    }))
  );

  return jobs;
}

const PHOTO_PROMPT_SYSTEM = `You write GPT Image 2 prompts for Google Business Profile marketing photos.

Rules:
- Photorealistic professional commercial photography — looks like a skilled local photographer shot it
- NO text overlays, logos, watermarks, or readable business signage with specific names
- NEVER invent a fake storefront or building facade for a named business (Google policy)
- Show believable service work: hands-on labor, equipment, vehicles, finished results, happy customers from behind/side angles
- Warm natural lighting, sharp subject focus, subtle depth of field
- Reflect the industry and regional context (climate, setting) without clichés
- Each imagePrompt is 2-4 vivid sentences the image model can render directly
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
          content: `Write image prompts for these GBP photo jobs. Match each title exactly.

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
    { "title": "exact title from list", "imagePrompt": "detailed image generation prompt" }
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

/** Build a model-compatible OpenAI Images API request body. */
export function buildOpenAiImageRequestBody(
  prompt: string,
  model: string
): Record<string, unknown> {
  const isGptImage = model.includes("gpt-image");
  const isDalle3 = model.includes("dall-e-3");

  const body: Record<string, unknown> = {
    model,
    prompt: prompt.trim(),
    n: 1,
  };

  if (isGptImage) {
    // GPT Image models always return base64 and reject response_format.
    body.size = "1536x1024";
    body.quality = "high";
  } else if (isDalle3) {
    body.size = "1024x1024";
    body.quality = "hd";
    body.style = "natural";
    body.response_format = "b64_json";
  } else {
    body.size = "1024x1024";
    body.response_format = "b64_json";
  }

  return body;
}

/** Generate an image via OpenAI Images API — returns bytes for direct GBP upload. */
export async function generateGbpPhotoImage(
  prompt: string
): Promise<{ bytes: ArrayBuffer; contentType: string; revisedPrompt?: string }> {
  const key = getOpenAiApiKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");

  const model = getOpenAiImageModel();
  const body = buildOpenAiImageRequestBody(prompt, model);

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
    return `AI photo ready in the Photos tab — ${job.hint}`;
  }

  return `Upload your real photo in the Photos tab — ${job.hint}`;
}
