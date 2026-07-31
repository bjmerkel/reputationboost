import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAction } from "@/lib/admin/auth";
import { listAdminNotes, createAdminNote } from "@/lib/admin/notes";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi("viewer");
  if (auth.error) return auth.error;

  const { userId } = await context.params;
  const notes = await listAdminNotes(userId);

  return NextResponse.json({ notes });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi("operator");
  if (auth.error) return auth.error;

  const { userId } = await context.params;
  const body = (await request.json()) as { body?: string };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Note body is required" }, { status: 400 });
  }

  const note = await createAdminNote({
    userId,
    authorId: auth.user.id,
    body: body.body,
  });

  await logAdminAction({
    adminUserId: auth.user.id,
    action: "create_note",
    targetType: "user",
    targetId: userId,
    metadata: { noteId: note.id },
  });

  return NextResponse.json({ note });
}
