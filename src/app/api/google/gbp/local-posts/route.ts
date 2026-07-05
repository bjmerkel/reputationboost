import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  analyzeGbpLocalPostCoverage,
  formatLocalPostCoverageSummary,
} from "@/lib/google/gbp-local-posts-coverage";
import {
  createGbpLocalPost,
  deleteGbpLocalPost,
  getGbpLocalPost,
  listGbpLocalPosts,
  LOCAL_POSTS_METHODS,
  LOCAL_POST_ACTION_TYPES,
  LOCAL_POST_TOPIC_TYPES,
  patchGbpLocalPost,
  probeLocalPostsApiAccess,
  reportGbpLocalPostInsights,
  type CreateGbpLocalPostInput,
  type GbpLocalPostActionType,
  type GbpLocalPostTopicType,
} from "@/lib/google/gbp-local-posts";
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

  return { connection };
}

export async function GET(request: Request) {
  const resolved = await resolveConnection();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { connection } = resolved as Exclude<typeof resolved, { error: NextResponse }>;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "probe";

  try {
    if (mode === "list") {
      const posts = await listGbpLocalPosts(connection);
      return NextResponse.json({
        posts,
        count: posts.length,
        coverage: analyzeGbpLocalPostCoverage({ posts }),
      });
    }

    if (mode === "get") {
      const name = searchParams.get("name");
      if (!name) {
        return NextResponse.json({ error: "name query parameter required" }, { status: 400 });
      }
      const post = await getGbpLocalPost(connection, name);
      return NextResponse.json({ post });
    }

    if (mode === "insights") {
      const posts = await listGbpLocalPosts(connection);
      const namesParam = searchParams.get("names");
      const names = namesParam
        ? namesParam.split(",").map((name) => name.trim()).filter(Boolean)
        : posts.slice(0, 10).map((post) => post.name);
      const insights = await reportGbpLocalPostInsights(connection, names, {
        days: Number(searchParams.get("days") ?? "90"),
      });
      return NextResponse.json({ insights, count: insights.length });
    }

    if (mode === "catalog") {
      return NextResponse.json({
        methods: LOCAL_POSTS_METHODS,
        topicTypes: LOCAL_POST_TOPIC_TYPES,
        actionTypes: LOCAL_POST_ACTION_TYPES,
      });
    }

    const probe = await probeLocalPostsApiAccess(connection);
    return NextResponse.json({
      ...probe,
      summary: probe.coverage ? formatLocalPostCoverageSummary(probe.coverage) : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local Posts API request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const resolved = await resolveConnection();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { connection } = resolved as Exclude<typeof resolved, { error: NextResponse }>;

  try {
    const body = (await request.json()) as CreateGbpLocalPostInput & {
      topicType?: GbpLocalPostTopicType;
      callToAction?: { actionType?: GbpLocalPostActionType; url?: string };
    };

    if (!body.summary?.trim()) {
      return NextResponse.json({ error: "summary required" }, { status: 400 });
    }

    const post = await createGbpLocalPost(connection, body);
    const posts = await listGbpLocalPosts(connection);

    return NextResponse.json({
      success: true,
      post,
      coverage: analyzeGbpLocalPostCoverage({ posts }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create local post";
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
      summary?: string;
      callToAction?: { actionType?: GbpLocalPostActionType; url?: string };
    };

    if (!body.name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    if (body.action === "delete") {
      await deleteGbpLocalPost(connection, body.name);
      const posts = await listGbpLocalPosts(connection);
      return NextResponse.json({
        success: true,
        coverage: analyzeGbpLocalPostCoverage({ posts }),
      });
    }

    const updateMask: string[] = [];
    if (body.summary !== undefined) updateMask.push("summary");
    if (body.callToAction !== undefined) updateMask.push("callToAction");

    if (updateMask.length === 0) {
      return NextResponse.json({ error: "summary or callToAction required for update" }, { status: 400 });
    }

    const post = await patchGbpLocalPost(
      connection,
      {
        name: body.name,
        summary: body.summary,
        callToAction: body.callToAction as CreateGbpLocalPostInput["callToAction"],
      },
      updateMask
    );

    const posts = await listGbpLocalPosts(connection);
    return NextResponse.json({
      success: true,
      post,
      coverage: analyzeGbpLocalPostCoverage({ posts }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update local post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
