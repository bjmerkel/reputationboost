import { NextResponse } from "next/server";
import { getPrimaryBusiness, listUserBusinesses } from "@/audit/businesses";
import { runPhase1Audit } from "@/audit/orchestrator";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { getUser } from "@/lib/supabase/server";
import type { AuditTrigger } from "@/audit/types";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businesses = await listUserBusinesses(user.id);
  const latest = await Promise.all(
    businesses.map(async (row) => {
      const latestAudit = await loadLatestAuditFromSupabase(user.id, row.slug);
      return {
        client: {
          id: row.slug,
          businessId: row.id,
          name: row.name,
          onboardingComplete: row.onboarding_complete,
          gbpConnected: Boolean(row.gbp_location_id),
        },
        latestAudit,
      };
    })
  );

  return NextResponse.json({ user: { id: user.id, email: user.email }, clients: latest });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      clientId?: string;
      trigger?: AuditTrigger;
    };

    const business = body.clientId
      ? await import("@/audit/businesses").then((m) =>
          m.loadBusinessConfig(user.id, body.clientId!)
        )
      : await getPrimaryBusiness(user.id);

    if (!business) {
      return NextResponse.json(
        { error: "No business found. Complete onboarding first." },
        { status: 400 }
      );
    }

    const result = await runPhase1Audit({
      clientId: business.id,
      trigger: body.trigger ?? "manual",
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
