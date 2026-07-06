import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { getExecutionTask, updateExecutionTask } from "@/audit/storage-execution";
import {
  checkGbpDescriptionEditStatus,
  editStatusIsFailure,
  editStatusResultMessage,
} from "@/lib/google/gbp-edit-status";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

/** Re-check Google's review status (Accepted / Pending / Not approved) for a published edit. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  const task = await getExecutionTask(user.id, taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.type !== "gbp_description") {
    return NextResponse.json(
      { error: "Status checks are only available for description edits." },
      { status: 400 }
    );
  }

  if (task.status !== "completed" && task.status !== "failed") {
    return NextResponse.json(
      { error: "Publish this edit before checking its review status." },
      { status: 400 }
    );
  }

  const business = await getPrimaryBusiness(user.id);
  const connection = business?.gbpConnection
    ? await getValidGbpConnection(user.id, business)
    : null;
  if (!connection) {
    return NextResponse.json(
      { error: "Connect Google Business Profile to check edit status." },
      { status: 400 }
    );
  }

  try {
    const statusResult = await checkGbpDescriptionEditStatus(connection, task.draftContent);

    const saved = await updateExecutionTask(user.id, taskId, {
      status: editStatusIsFailure(statusResult.status) ? "failed" : "completed",
      result: editStatusResultMessage(statusResult),
      payload: {
        ...task.payload,
        editStatus: {
          status: statusResult.status,
          label: statusResult.label,
          detail: statusResult.detail,
          checkedAt: statusResult.checkedAt,
        },
      },
    });

    return NextResponse.json({ task: saved ?? task, editStatus: statusResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status check failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
