import { NextResponse } from "next/server";
import { getPrimaryBusiness, loadBusinessConfig } from "@/audit/businesses";
import { suggestKeywords } from "@/lib/llm/keywords";
import { getUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      industry?: string;
      city?: string;
      state?: string;
      address?: string;
      website?: string;
      slug?: string;
      existingKeywords?: string[];
      replaceKeyword?: string;
      gbpSearchTerms?: string[];
    };

    const business = body.slug
      ? await loadBusinessConfig(user.id, body.slug).catch(() => null)
      : await getPrimaryBusiness(user.id);

    const name = body.name?.trim() || business?.name || "";
    const industry = body.industry?.trim() || business?.industry || "";
    const city = body.city?.trim() || business?.location?.city || "";
    const state = body.state?.trim() || business?.location?.state || "";
    const address =
      body.address?.trim() ||
      [
        business?.location?.address,
        business?.location?.city,
        business?.location?.state,
        business?.location?.zip,
      ]
        .filter(Boolean)
        .join(", ") ||
      undefined;
    const website = body.website?.trim() || business?.website || undefined;
    const existingKeywords =
      body.existingKeywords?.map((k) => k.trim()).filter(Boolean) ??
      business?.keywords ??
      [];

    if (!name || !industry) {
      return NextResponse.json(
        { error: "Business name and industry are required" },
        { status: 400 }
      );
    }

    const result = await suggestKeywords({
      name,
      industry,
      city,
      state,
      address,
      website,
      existingKeywords,
      replaceKeyword: body.replaceKeyword?.trim(),
      gbpSearchTerms: body.gbpSearchTerms?.map((k) => k.trim()).filter(Boolean),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Keyword suggestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
