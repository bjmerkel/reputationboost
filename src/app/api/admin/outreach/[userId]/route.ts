import { NextResponse } from "next/server";
import { logAdminAction, requireAdminApi } from "@/lib/admin/auth";
import { createAdminNote } from "@/lib/admin/notes";
import { playbookStepLabel } from "@/lib/admin/playbook";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi("operator");
  if (auth.error) return auth.error;

  const { userId } = await context.params;
  const body = (await request.json()) as { stepId?: string; note?: string };
  const stepId = body.stepId?.trim();
  if (!stepId) {
    return NextResponse.json({ error: "stepId is required" }, { status: 400 });
  }

  let noteId: string | null = null;
  if (body.note?.trim()) {
    const note = await createAdminNote({
      userId,
      authorId: auth.user.id,
      body: body.note.trim(),
    });
    noteId = note.id;
  }

  await logAdminAction({
    adminUserId: auth.user.id,
    action: "playbook_step",
    targetType: "user",
    targetId: userId,
    metadata: {
      stepId,
      stepLabel: playbookStepLabel(stepId),
      noteId,
    },
  });

  return NextResponse.json({ ok: true, stepId, noteId });
}
