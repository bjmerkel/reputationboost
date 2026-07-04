import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  createGbpMediaFromUrl,
  deleteGbpMedia,
  fetchGbpMediaSummary,
  listGbpMedia,
  patchGbpMediaCategory,
  uploadGbpMediaFile,
  type GbpMediaCategory,
  type GbpMediaFormat,
} from "@/lib/google/gbp-media";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

/** List media or return summary counts for the connected location. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const business = await getPrimaryBusiness(user.id);
    if (!business?.gbpConnection) {
      return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
    }

    const connection = await getValidGbpConnection(user.id, business);
    if (!connection) {
      return NextResponse.json({ error: "GBP connection expired" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get("summary") === "1") {
      const summary = await fetchGbpMediaSummary(connection);
      return NextResponse.json({ summary });
    }

    const items = await listGbpMedia(connection);
    return NextResponse.json({ items: items.items, totalCount: items.totalMediaItemCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load media";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Upload media via public URL (JSON) or file bytes (multipart). */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const business = await getPrimaryBusiness(user.id);
    if (!business?.gbpConnection) {
      return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
    }

    const connection = await getValidGbpConnection(user.id, business);
    if (!connection) {
      return NextResponse.json({ error: "GBP connection expired. Reconnect in Settings." }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const mediaFormat = (String(form.get("mediaFormat") ?? "PHOTO") as GbpMediaFormat);
      const category = (String(form.get("category") ?? "ADDITIONAL") as GbpMediaCategory);
      const description = String(form.get("description") ?? "");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const item = await uploadGbpMediaFile(
        connection,
        { bytes, contentType: file.type || "application/octet-stream" },
        { mediaFormat, category, description: description || undefined }
      );

      return NextResponse.json({ success: true, item });
    }

    const body = (await request.json()) as {
      sourceUrl?: string;
      mediaFormat?: GbpMediaFormat;
      category?: GbpMediaCategory;
      description?: string;
    };

    if (!body.sourceUrl?.trim()) {
      return NextResponse.json({ error: "sourceUrl is required" }, { status: 400 });
    }

    const item = await createGbpMediaFromUrl(connection, {
      sourceUrl: body.sourceUrl.trim(),
      mediaFormat: body.mediaFormat ?? "PHOTO",
      category: body.category ?? "ADDITIONAL",
      description: body.description,
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Delete a media item by resource name. */
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mediaName = searchParams.get("name");
    if (!mediaName) {
      return NextResponse.json({ error: "name query param is required" }, { status: 400 });
    }

    const business = await getPrimaryBusiness(user.id);
    if (!business?.gbpConnection) {
      return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
    }

    const connection = await getValidGbpConnection(user.id, business);
    if (!connection) {
      return NextResponse.json({ error: "GBP connection expired" }, { status: 401 });
    }

    await deleteGbpMedia(connection, mediaName);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Recategorize an existing media item. */
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      category?: GbpMediaCategory;
    };

    if (!body.name || !body.category) {
      return NextResponse.json({ error: "name and category are required" }, { status: 400 });
    }

    const business = await getPrimaryBusiness(user.id);
    if (!business?.gbpConnection) {
      return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
    }

    const connection = await getValidGbpConnection(user.id, business);
    if (!connection) {
      return NextResponse.json({ error: "GBP connection expired" }, { status: 401 });
    }

    const item = await patchGbpMediaCategory(connection, body.name, body.category);
    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
