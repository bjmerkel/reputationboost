import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { getExecutionTask, updateExecutionTask } from "@/audit/storage-execution";
import { computeAttributionAfterTaskCompletion } from "@/audit/attribution";
import {
  dataUrlToBytes,
  uploadGbpMediaPreview,
  type GbpMediaCategory,
} from "@/lib/google/gbp-media";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

function previewFromTask(task: Awaited<ReturnType<typeof getExecutionTask>>): string | undefined {
  const preview = task?.payload.previewDataUrl;
  return typeof preview === "string" && preview.startsWith("data:") ? preview : undefined;
}

async function persistPreviewOnTask(
  userId: string,
  taskId: string,
  task: NonNullable<Awaited<ReturnType<typeof getExecutionTask>>>,
  previewDataUrl: string
) {
  if (previewDataUrl === task.payload.previewDataUrl) return task;
  const merged = await updateExecutionTask(userId, taskId, {
    payload: { ...task.payload, previewDataUrl },
  });
  if (!merged) {
    throw new Error("Failed to save photo preview before publishing to Google.");
  }
  return merged;
}

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
      const imageType = file.type || "image/jpeg";
      const previewDataUrl = `data:${imageType};base64,${Buffer.from(bytes).toString("base64")}`;
      task = await persistPreviewOnTask(user.id, taskId, task, previewDataUrl);

      const item = await uploadGbpMediaPreview(
        connection,
        taskId,
        { bytes, contentType: imageType },
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
        payload: {
          ...task.payload,
          previewDataUrl: undefined,
          uploadedMediaName: item.name,
          uploadedGoogleUrl: item.googleUrl,
        },
      });

      void computeAttributionAfterTaskCompletion(user.id, taskId);

      return NextResponse.json({ task: saved, message: saved?.result });
    }

    let body: { previewDataUrl?: string } = {};
    try {
      body = (await request.json()) as { previewDataUrl?: string };
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const previewDataUrl = body.previewDataUrl ?? previewFromTask(task);
    if (!previewDataUrl) {
      return NextResponse.json(
        { error: "Generate or upload a photo preview before publishing." },
        { status: 400 }
      );
    }

    task = await persistPreviewOnTask(user.id, taskId, task, previewDataUrl);

    if (task.status === "pending_approval" || task.status === "rejected") {
      const approved = await updateExecutionTask(user.id, taskId, {
        status: "approved",
        scheduledFor: new Date().toISOString(),
      });
      if (approved) task = approved;
    }

    const category = (task.payload.category as GbpMediaCategory) ?? "ADDITIONAL";
    const description = (task.payload.hint as string) || task.title;
    const { bytes, contentType: imageType } = dataUrlToBytes(previewDataUrl);

    const item = await uploadGbpMediaPreview(
      connection,
      taskId,
      { bytes, contentType: imageType },
      {
        mediaFormat: "PHOTO",
        category,
        description,
      }
    );

    const now = new Date().toISOString();
    const saved = await updateExecutionTask(user.id, taskId, {
      status: "completed",
      completedAt: now,
      result: `Photo uploaded to Google (${category}).`,
      payload: {
        ...task.payload,
        previewDataUrl: undefined,
        uploadedMediaName: item.name,
        uploadedGoogleUrl: item.googleUrl,
      },
    });

    void computeAttributionAfterTaskCompletion(user.id, taskId);

    return NextResponse.json({ task: saved, message: saved?.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
