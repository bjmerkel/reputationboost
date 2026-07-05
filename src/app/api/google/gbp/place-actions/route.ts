import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  analyzeGbpPlaceActionCoverage,
  formatPlaceActionCoverageSummary,
} from "@/lib/google/gbp-place-actions-coverage";
import {
  createGbpPlaceActionLink,
  deleteGbpPlaceActionLink,
  getGbpPlaceActionLink,
  listGbpPlaceActionLinks,
  listGbpPlaceActionTypeMetadata,
  patchGbpPlaceActionLink,
  PLACE_ACTIONS_METHODS,
  probePlaceActionsApiAccess,
  type GbpPlaceActionType,
} from "@/lib/google/gbp-place-actions";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

async function resolveConnection() {
  const user = await getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const business = await getPrimaryBusiness(user.id);
  if (!business?.gbpConnection) {
    return { error: NextResponse.json({ error: "GBP not connected" }, { status: 400 }) };
  }

  const connection = await getValidGbpConnection(user.id, business);
  if (!connection) {
    return { error: NextResponse.json({ error: "GBP connection expired" }, { status: 401 }) };
  }

  return { user, business, connection };
}

export async function GET(request: Request) {
  const resolved = await resolveConnection();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { business, connection } = resolved as Exclude<typeof resolved, { error: NextResponse }>;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "probe";

  try {
    if (mode === "links") {
      const links = await listGbpPlaceActionLinks(connection);
      return NextResponse.json({ links, count: links.length });
    }

    if (mode === "types") {
      const types = await listGbpPlaceActionTypeMetadata(connection, {
        languageCode: searchParams.get("languageCode") ?? undefined,
        filter: searchParams.get("filter") ?? undefined,
      });
      return NextResponse.json({ types, count: types.length });
    }

    if (mode === "get") {
      const name = searchParams.get("name");
      if (!name) {
        return NextResponse.json({ error: "name query parameter required" }, { status: 400 });
      }
      const link = await getGbpPlaceActionLink(connection, name);
      return NextResponse.json({ link });
    }

    if (mode === "catalog") {
      return NextResponse.json({ methods: PLACE_ACTIONS_METHODS });
    }

    const probe = await probePlaceActionsApiAccess(connection, {
      primaryCategory: business.industry,
    });

    return NextResponse.json({
      ...probe,
      summary: probe.coverage ? formatPlaceActionCoverageSummary(probe.coverage) : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Place Actions API request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const resolved = await resolveConnection();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { connection } = resolved as Exclude<typeof resolved, { error: NextResponse }>;

  try {
    const body = (await request.json()) as {
      uri?: string;
      placeActionType?: GbpPlaceActionType;
      isPreferred?: boolean;
    };

    if (!body.uri || !body.placeActionType) {
      return NextResponse.json({ error: "uri and placeActionType required" }, { status: 400 });
    }

    const link = await createGbpPlaceActionLink(connection, {
      uri: body.uri,
      placeActionType: body.placeActionType,
      isPreferred: body.isPreferred,
    });

    const [links, availableTypes] = await Promise.all([
      listGbpPlaceActionLinks(connection),
      listGbpPlaceActionTypeMetadata(connection).catch(() => []),
    ]);

    return NextResponse.json({
      success: true,
      link,
      coverage: analyzeGbpPlaceActionCoverage({ links, availableTypes }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create place action link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const resolved = await resolveConnection();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { connection } = resolved as Exclude<typeof resolved, { error: NextResponse }>;

  try {
    const body = (await request.json()) as {
      action?: "update" | "delete";
      name?: string;
      uri?: string;
      isPreferred?: boolean;
    };

    if (!body.name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    if (body.action === "delete") {
      await deleteGbpPlaceActionLink(connection, body.name);
      const [links, availableTypes] = await Promise.all([
        listGbpPlaceActionLinks(connection),
        listGbpPlaceActionTypeMetadata(connection).catch(() => []),
      ]);
      return NextResponse.json({
        success: true,
        coverage: analyzeGbpPlaceActionCoverage({ links, availableTypes }),
      });
    }

    const updateMask: string[] = [];
    if (body.uri !== undefined) updateMask.push("uri");
    if (body.isPreferred !== undefined) updateMask.push("isPreferred");

    if (updateMask.length === 0) {
      return NextResponse.json({ error: "uri or isPreferred required for update" }, { status: 400 });
    }

    const link = await patchGbpPlaceActionLink(
      connection,
      { name: body.name, uri: body.uri, isPreferred: body.isPreferred },
      updateMask
    );

    const [links, availableTypes] = await Promise.all([
      listGbpPlaceActionLinks(connection),
      listGbpPlaceActionTypeMetadata(connection).catch(() => []),
    ]);

    return NextResponse.json({
      success: true,
      link,
      coverage: analyzeGbpPlaceActionCoverage({ links, availableTypes }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update place action link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
