import { NextResponse } from "next/server";
import { getExecutionTaskAdmin } from "@/audit/storage-execution";
import { dataUrlToBytes } from "@/lib/google/gbp-media";
import { verifyMediaHostToken } from "@/lib/google/gbp-media-host";

/** Public image endpoint for Google sourceUrl media uploads (no auth cookies). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string; token: string }> }
) {
  const { taskId, token } = await params;
  if (!verifyMediaHostToken(taskId, token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const task = await getExecutionTaskAdmin(taskId);
  const preview = task?.payload.previewDataUrl;
  if (typeof preview !== "string" || !preview.startsWith("data:")) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const { bytes, contentType } = dataUrlToBytes(preview);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
