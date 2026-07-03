import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { executeTask } from "@/audit/phase3/executor";
import { getExecutionTask, updateExecutionTask } from "@/audit/storage-execution";
import {
  uploadGbpMediaFile,
  type GbpMediaCategory,
} from "@/lib/google/gbp-media";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

/** One-click: save preview (optional), approve, and upload photo to Google. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  let task = await getExecutionTask(user.id, taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.type !== "gbp_photo") {
    return NextResponse.json({ error: "Not a photo task" }, { status: 400 });
  }

  if (task.status === "completed") {
    return NextResponse.json({ task, message: "Already uploaded." });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.gbpConnection) {
    return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
  }

  const connection = await getValidGbpConnection(user.id, business);
  if (!connection) {
    return NextResponse.json({ error: "GBP connection expired. Reconnect in Settings." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }

      const category = (String(
        form.get("category") ?? task.payload.category ?? "ADDITIONAL"
      ) as GbpMediaCategory);
      const bytes = await file.arrayBuffer();

      const item = await uploadGbpMediaFile(
        connection,
        { bytes, contentType: file.type || "image/jpeg" },
        {
          mediaFormat: "PHOTO",
          category,
          description: (task.payload.hint as string) || task.title,
        }
      );

      const now = new Date().toISOString();
      const saved = await updateExecutionTask(user.id, taskId, {
        status: "completed",
        completedAt: now,
        result: `Photo uploaded to Google (${category}).`,
        payload: { ...task.payload, uploadedMediaName: item.name },
      });

      return NextResponse.json({ task: saved, message: saved?.result });
    }

    const body = (await request.json().catch(() => ({}))) as {
      previewDataUrl?: string;
    };

    if (body.previewDataUrl) {
      const merged = await updateExecutionTask(user.id, taskId, {
        payload: { ...task.payload, previewDataUrl: body.previewDataUrl },
      });
      if (merged) task = merged;
    }

    if (task.status === "pending_approval" || task.status === "rejected") {
      const approved = await updateExecutionTask(user.id, taskId, {
        status: "approved",
        scheduledFor: new Date().toISOString(),
      });
      if (approved) task = approved;
    }

    const executed = await executeTask(task, connection);
    const saved = await updateExecutionTask(user.id, taskId, {
      status: executed.status,
      completedAt: executed.completedAt,
      result: executed.result,
      payload: {
        ...task.payload,
        previewDataUrl: undefined,
      },
    });

    return NextResponse.json({ task: saved, message: saved?.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
