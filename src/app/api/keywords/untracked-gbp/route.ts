import { NextResponse } from "next/server";
import { getPrimaryBusiness, loadBusinessConfig } from "@/audit/businesses";
import { listUntrackedGbpSearchTerms } from "@/audit/phase2/keyword-portfolio";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { selectUntrackedGbpOpportunities } from "@/lib/llm/untracked-gbp";
import { getUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      slug?: string;
      name?: string;
      industry?: string;
      city?: string;
      state?: string;
      address?: string;
      trackedKeywords?: string[];
      gbpSearchTerms?: Array<{
        keyword: string;
        impressions: number | null;
        belowThreshold: boolean;
      }>;
      limit?: number;
    };

    const business = body.slug
      ? await loadBusinessConfig(user.id, body.slug).catch(() => null)
      : await getPrimaryBusiness(user.id);

    const audit =
      business?.id != null
        ? await loadLatestAuditFromSupabase(user.id, business.id).catch(() => null)
        : null;

    const name = body.name?.trim() || business?.name || audit?.clientName || "";
    const industry =
      body.industry?.trim() ||
      business?.industry ||
      audit?.gbp.identity.primaryCategory ||
      "";
    const city =
      body.city?.trim() ||
      business?.location?.city ||
      audit?.gbp.identity.address.split(",")[1]?.trim() ||
      "";
    const state =
      body.state?.trim() ||
      business?.location?.state ||
      audit?.gbp.identity.address.match(/,\s*([A-Z]{2})\s+\d{5}/)?.[1] ||
      "";
    const address =
      body.address?.trim() ||
      audit?.gbp.identity.address ||
      [
        business?.location?.address,
        business?.location?.city,
        business?.location?.state,
        business?.location?.zip,
      ]
        .filter(Boolean)
        .join(", ") ||
      undefined;

    const trackedKeywords =
      body.trackedKeywords?.map((keyword) => keyword.trim()).filter(Boolean) ??
      business?.keywords ??
      audit?.rankings.keywords.map((keyword) => keyword.keyword) ??
      [];

    const gbpSearchTerms =
      body.gbpSearchTerms ??
      (audit ? listUntrackedGbpSearchTerms(audit) : []);

    if (!name || !industry) {
      return NextResponse.json(
        { error: "Business name and industry are required" },
        { status: 400 }
      );
    }

    const result = await selectUntrackedGbpOpportunities({
      name,
      industry,
      city,
      state,
      address,
      trackedKeywords,
      gbpSearchTerms,
      limit: body.limit ?? 8,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Untracked GBP selection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
