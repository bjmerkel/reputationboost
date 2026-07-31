import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminNote {
  id: string;
  userId: string;
  authorId: string | null;
  authorEmail: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export async function listAdminNotes(userId: string): Promise<AdminNote[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_notes")
    .select("id, user_id, author_id, body, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list admin notes: ${error.message}`);

  const notes = data ?? [];
  const authorIds = [...new Set(notes.map((note) => note.author_id).filter(Boolean))] as string[];

  const authorEmails = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", authorIds);
    for (const profile of profiles ?? []) {
      if (profile.email) authorEmails.set(profile.id, profile.email);
    }
  }

  return notes.map((note) => ({
    id: note.id,
    userId: note.user_id,
    authorId: note.author_id,
    authorEmail: note.author_id ? authorEmails.get(note.author_id) ?? null : null,
    body: note.body,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  }));
}

export async function createAdminNote(input: {
  userId: string;
  authorId: string;
  body: string;
}): Promise<AdminNote> {
  const supabase = createAdminClient();
  const trimmed = input.body.trim();
  if (!trimmed) throw new Error("Note body is required");

  const { data, error } = await supabase
    .from("admin_notes")
    .insert({
      user_id: input.userId,
      author_id: input.authorId,
      body: trimmed,
    })
    .select("id, user_id, author_id, body, created_at, updated_at")
    .single();

  if (error || !data) throw new Error(`Failed to create admin note: ${error?.message}`);

  const { data: author } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", input.authorId)
    .maybeSingle();

  return {
    id: data.id,
    userId: data.user_id,
    authorId: data.author_id,
    authorEmail: author?.email ?? null,
    body: data.body,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
