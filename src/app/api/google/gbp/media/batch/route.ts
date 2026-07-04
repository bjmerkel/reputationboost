import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  uploadGbpMediaFile,
  type GbpMediaCategory,
  type GbpMediaFormat,
} from "@/lib/google/gbp-media";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

interface BatchUploadResult {
  fileName: string;
  success: boolean;
  mediaName?: string;
  error?: string;
}

/** Upload multiple media files in one request (category-targeted batch). */
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

    const form = await request.formData();
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
    const categoriesRaw = form.get("categories");
    const mediaFormat = String(form.get("mediaFormat") ?? "PHOTO") as GbpMediaFormat;

    if (files.length === 0) {
      return NextResponse.json({ error: "At least one file is required" }, { status: 400 });
    }

    if (files.length > 8) {
      return NextResponse.json({ error: "Maximum 8 files per batch" }, { status: 400 });
    }

    let categories: string[] = [];
    if (typeof categoriesRaw === "string" && categoriesRaw.trim()) {
      try {
        categories = JSON.parse(categoriesRaw) as string[];
      } catch {
        categories = categoriesRaw.split(",").map((c) => c.trim());
      }
    }

    const results: BatchUploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const category = (categories[i] ?? categories[0] ?? "ADDITIONAL") as GbpMediaCategory;

      try {
        const bytes = await file.arrayBuffer();
        const item = await uploadGbpMediaFile(
          connection,
          { bytes, contentType: file.type || "application/octet-stream" },
          { mediaFormat, category }
        );
        results.push({
          fileName: file.name,
          success: true,
          mediaName: item.name,
        });
      } catch (error) {
        results.push({
          fileName: file.name,
          success: false,
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    return NextResponse.json({
      success: succeeded > 0,
      uploaded: succeeded,
      total: files.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
