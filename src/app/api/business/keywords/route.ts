import { NextResponse } from "next/server";
import {
  getPrimaryBusiness,
  loadBusinessConfig,
  updateBusinessKeywords,
} from "@/audit/businesses";
import { persistTrackedKeywordsToLatestAudit } from "@/audit/live-audit";
import { computeKeywordPortfolio } from "@/audit/phase2/keyword-portfolio";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const business = slug
      ? await loadBusinessConfig(user.id, slug)
      : await getPrimaryBusiness(user.id);

    if (!business?.businessId) {
      return NextResponse.json({ error: "No business configured" }, { status: 400 });
    }

    const audit = await loadLatestAuditFromSupabase(user.id, business.id);
    if (!audit) {
      return NextResponse.json({
        keywords: business.keywords,
        portfolio: null,
        message: "Run an audit to generate keyword portfolio recommendations.",
      });
    }

    const portfolio = audit.keywordPortfolio ?? computeKeywordPortfolio(audit);
    return NextResponse.json({
      keywords: business.keywords,
      portfolio,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load keyword portfolio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      businessId?: string;
      slug?: string;
      keywords?: string[];
      applyRecommendations?: boolean;
      /** Replace one tracked keyword with another (keeps the rest). */
      replace?: { from: string; to: string };
      /** Remove one tracked keyword (must leave at least 3). */
      remove?: string;
      /** Append one keyword (must stay at or under 8). */
      add?: string;
    };

    const business = body.slug
      ? await loadBusinessConfig(user.id, body.slug)
      : await getPrimaryBusiness(user.id);
    const businessId = body.businessId ?? business?.businessId;

    if (!businessId || !business) {
      return NextResponse.json({ error: "No business configured" }, { status: 400 });
    }

    let keywords = body.keywords?.filter(Boolean);

    if (body.applyRecommendations) {
      const audit = await loadLatestAuditFromSupabase(user.id, business.id);
      if (!audit) {
        return NextResponse.json(
          { error: "Run an audit before applying keyword recommendations." },
          { status: 400 }
        );
      }
      const portfolio = audit.keywordPortfolio ?? computeKeywordPortfolio(audit);
      keywords = portfolio.recommendedKeywords;
    } else if (body.replace?.from && body.replace?.to) {
      const from = body.replace.from.trim().toLowerCase();
      const to = body.replace.to.trim().toLowerCase();
      if (!to) {
        return NextResponse.json({ error: "Replacement keyword is required." }, { status: 400 });
      }
      const current = business.keywords.map((k) => k.trim().toLowerCase());
      const index = current.findIndex((k) => k === from);
      if (index < 0) {
        return NextResponse.json({ error: `Keyword not found: ${body.replace.from}` }, { status: 400 });
      }
      if (current.some((k, i) => i !== index && k === to)) {
        return NextResponse.json({ error: "That keyword is already tracked." }, { status: 400 });
      }
      current[index] = to;
      keywords = current;
    } else if (body.remove) {
      const remove = body.remove.trim().toLowerCase();
      keywords = business.keywords
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k !== remove);
    } else if (body.add) {
      const add = body.add.trim().toLowerCase();
      if (!add) {
        return NextResponse.json({ error: "Keyword is required." }, { status: 400 });
      }
      const current = business.keywords.map((k) => k.trim().toLowerCase());
      if (current.includes(add)) {
        return NextResponse.json({ error: "That keyword is already tracked." }, { status: 400 });
      }
      keywords = [...current, add];
    }

    if (!keywords || keywords.length < 3) {
      return NextResponse.json({ error: "At least 3 keywords are required." }, { status: 400 });
    }

    const updated = await updateBusinessKeywords(user.id, businessId, keywords);
    if (business.businessId) {
      await persistTrackedKeywordsToLatestAudit({
        businessId: business.businessId,
        keywords: updated.keywords,
      }).catch((error) => {
        console.error("[keywords] failed to sync audit rankings:", error);
      });
    }
    return NextResponse.json({ business: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update keywords";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
