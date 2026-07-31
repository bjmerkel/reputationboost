import type { AdminNote } from "@/lib/admin/notes";
import AdminNotesForm from "@/components/admin/AdminNotesForm";

export default function AdminNotesPanel({
  userId,
  notes,
  canWrite,
}: {
  userId: string;
  notes: AdminNote[];
  canWrite: boolean;
}) {
  return (
    <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
      <h2 className="text-lg font-semibold text-white">Admin notes</h2>
      <p className="mt-1 text-sm text-[#64748b]">Internal notes visible only to admins.</p>

      {canWrite ? (
        <div className="mt-4">
          <AdminNotesForm userId={userId} />
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {notes.length === 0 ? (
          <p className="text-sm text-[#64748b]">No notes yet.</p>
        ) : (
          notes.map((note) => (
            <article key={note.id} className="rounded-lg border border-[#2d3348] bg-[#1a1f2e] p-4">
              <p className="whitespace-pre-wrap text-sm text-[#e2e8f0]">{note.body}</p>
              <p className="mt-3 text-xs text-[#64748b]">
                {note.authorEmail ?? "Unknown admin"} ·{" "}
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
