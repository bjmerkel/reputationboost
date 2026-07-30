import { NextResponse } from "next/server";
import { recordProfileGuideEventAdmin } from "@/lib/profile-guide/storage-admin";
import type { ProfileGuideEventType } from "@/lib/profile-guide/types";

function parseEvent(body: unknown): {
  guideId: string;
  linkId?: string | null;
  eventType: ProfileGuideEventType;
  source?: string | null;
  referrer?: string | null;
} | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const name = record.name;
  const guideId = record.guideId;

  if (typeof guideId !== "string" || !guideId) return null;

  let eventType: ProfileGuideEventType | null = null;
  if (name === "profile_guide_view") eventType = "view";
  if (name === "profile_guide_click") eventType = "click";
  if (!eventType) return null;

  return {
    guideId,
    linkId: typeof record.linkId === "string" ? record.linkId : null,
    eventType,
    source: typeof record.source === "string" ? record.source : null,
    referrer: typeof record.referrer === "string" ? record.referrer : null,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = parseEvent(body);
  if (!event) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  try {
    await recordProfileGuideEventAdmin({
      guideId: event.guideId,
      linkId: event.linkId,
      eventType: event.eventType,
      source: event.source,
      referrer: event.referrer,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
