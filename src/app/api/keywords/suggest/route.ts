import { NextResponse } from "next/server";
import { suggestKeywords } from "@/lib/llm/keywords";
import { getUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name: string;
      industry: string;
      city: string;
      state: string;
      address?: string;
      website?: string;
      existingKeywords?: string[];
      replaceKeyword?: string;
      gbpSearchTerms?: string[];
    };

    if (!body.name?.trim() || !body.industry?.trim()) {
      return NextResponse.json(
        { error: "Business name and industry are required" },
        { status: 400 }
      );
    }

    const result = await suggestKeywords({
      name: body.name.trim(),
      industry: body.industry.trim(),
      city: body.city?.trim() ?? "",
      state: body.state?.trim() ?? "",
      address: body.address?.trim(),
      website: body.website?.trim(),
      existingKeywords: body.existingKeywords?.map((k) => k.trim()).filter(Boolean),
      replaceKeyword: body.replaceKeyword?.trim(),
      gbpSearchTerms: body.gbpSearchTerms?.map((k) => k.trim()).filter(Boolean),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Keyword suggestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
