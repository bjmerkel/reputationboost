import { NextResponse } from "next/server";
import { runPreviewAudit, type PreviewAuditInput } from "@/audit/preview-audit";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(`preview-audit:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many preview audits. Please try again later or sign up for your full score." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const body = (await request.json()) as Partial<PreviewAuditInput>;

    if (!body.placeId?.trim() || !body.name?.trim()) {
      return NextResponse.json(
        { error: "placeId and name are required" },
        { status: 400 }
      );
    }

    if (
      typeof body.lat !== "number" ||
      typeof body.lng !== "number" ||
      !Number.isFinite(body.lat) ||
      !Number.isFinite(body.lng)
    ) {
      return NextResponse.json(
        { error: "Valid lat and lng are required" },
        { status: 400 }
      );
    }

    const input: PreviewAuditInput = {
      placeId: body.placeId.trim(),
      name: body.name.trim(),
      industry: body.industry?.trim(),
      address: body.address?.trim() ?? "",
      city: body.city?.trim() ?? "",
      state: body.state?.trim() ?? "",
      zip: body.zip?.trim() ?? "",
      lat: body.lat,
      lng: body.lng,
      phone: body.phone?.trim(),
      website: body.website?.trim(),
    };

    const result = await runPreviewAudit(input);

    return NextResponse.json(result, {
      headers: {
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview audit failed";
    console.error("[preview-audit]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
