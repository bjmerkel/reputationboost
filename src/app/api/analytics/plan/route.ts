import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  logPlanEvent,
  type PlanAnalyticsEvent,
  type PlanAnalyticsEventName,
} from "@/lib/analytics/plan-events";
import { getUser } from "@/lib/supabase/server";

const ALLOWED_EVENTS = new Set<PlanAnalyticsEventName>([
  "plan_nba_click",
  "plan_keyword_playbook_cta",
  "plan_publish_success",
  "plan_reconcile_live",
]);

function parseEvent(body: unknown): PlanAnalyticsEvent | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const name = record.name;
  if (typeof name !== "string" || !ALLOWED_EVENTS.has(name as PlanAnalyticsEventName)) {
    return null;
  }

  return {
    name: name as PlanAnalyticsEventName,
    businessId: typeof record.businessId === "string" ? record.businessId : null,
    auditId: typeof record.auditId === "string" ? record.auditId : null,
    stepNumber: typeof record.stepNumber === "number" ? record.stepNumber : null,
    keyword: typeof record.keyword === "string" ? record.keyword : null,
    taskId: typeof record.taskId === "string" ? record.taskId : null,
    taskType: typeof record.taskType === "string" ? record.taskType : null,
    meta:
      record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
        ? (record.meta as Record<string, string | number | boolean | null>)
        : undefined,
    occurredAt: typeof record.occurredAt === "string" ? record.occurredAt : undefined,
  };
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const business = await getPrimaryBusiness(user.id);
  logPlanEvent({
    ...event,
    businessId: event.businessId ?? business?.businessId ?? null,
    meta: {
      ...event.meta,
      userId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
