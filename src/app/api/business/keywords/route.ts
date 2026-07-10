import { NextResponse } from "next/server";
import {
  getPrimaryBusiness,
  loadBusinessConfig,
  updateBusinessKeywords,
} from "@/audit/businesses";
import { cloneAudit } from "@/audit/phase2/counterfactual";
import {
  applyKeywordPortfolioToAudit,
  computeKeywordPortfolio,
} from "@/audit/phase2/keyword-portfolio";
import { persistLiveAuditSnapshot } from "@/audit/live-audit";
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
    };

    const business = body.slug
      ? await loadBusinessConfig(user.id, body.slug)
      : await getPrimaryBusiness(user.id);
    const businessId = body.businessId ?? business?.businessId;

    if (!businessId || !business) {
      return NextResponse.json({ error: "No business configured" }, { status: 400 });
    }

    let keywords = body.keywords?.filter(Boolean);
    const audit = await loadLatestAuditFromSupabase(user.id, business.id);

    if (body.applyRecommendations) {
      if (!audit) {
        return NextResponse.json(
          { error: "Run an audit before applying keyword recommendations." },
          { status: 400 }
        );
      }
      const portfolio = audit.keywordPortfolio ?? computeKeywordPortfolio(audit);
      keywords = portfolio.recommendedKeywords;
    }

    if (!keywords || keywords.length < 3) {
      return NextResponse.json({ error: "At least 3 keywords are required." }, { status: 400 });
    }

    const updated = await updateBusinessKeywords(user.id, businessId, keywords);

    // Keep the latest audit rankings/portfolio in sync so Plan/Home hide the
    // keyword portfolio panel after recommendations are applied.
    if (body.applyRecommendations && audit && business.businessId) {
      try {
        const next = cloneAudit(audit);
        applyKeywordPortfolioToAudit(next);
        await persistLiveAuditSnapshot(business.businessId, next);
      } catch {
        // Non-fatal: business keywords were already saved.
      }
    }

    return NextResponse.json({ business: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update keywords";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
