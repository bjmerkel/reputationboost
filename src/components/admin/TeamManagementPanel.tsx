"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminTeamMember } from "@/lib/admin/team";
import type { AdminRole } from "@/lib/admin/types";

function roleLabel(role: AdminTeamMember["role"]): string {
  if (role === "god_mode") return "God mode";
  if (role === "operator") return "Operator";
  if (role === "viewer") return "Viewer";
  return "Superadmin";
}

export default function TeamManagementPanel({ members }: { members: AdminTeamMember[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("operator");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowLoading, setRowLoading] = useState<string | null>(null);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to add team member");

      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add team member");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(userId: string, nextRole: AdminRole) {
    setRowLoading(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/team/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to update role");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setRowLoading(null);
    }
  }

  async function handleRemove(userId: string) {
    if (!window.confirm("Remove this person's admin access?")) return;

    setRowLoading(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/team/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to remove team member");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove team member");
    } finally {
      setRowLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
        <h2 className="text-lg font-semibold text-white">Add operator or viewer</h2>
        <p className="mt-1 text-sm text-[#94a3b8]">
          The person must already have a Reputation Boost account (signed up at least once).
        </p>

        <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#64748b]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="operator@company.com"
              className="w-full rounded-lg border border-[#334155] bg-[#1e2433] px-3 py-2 text-sm text-white placeholder:text-[#64748b] focus:border-[#6366f1] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#64748b]">
              Role
            </label>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AdminRole)}
              className="rounded-lg border border-[#334155] bg-[#1e2433] px-3 py-2 text-sm text-white focus:border-[#6366f1] focus:outline-none"
            >
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving || !email.trim()}
            className="rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Adding…" : "Grant access"}
          </button>
        </form>
      </section>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <section className="overflow-hidden rounded-xl border border-[#2d3348] bg-[#151923]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#1a1f2e] text-[#64748b]">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Granted</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={`${member.email}-${member.userId ?? "god"}`} className="border-t border-[#2d3348]/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{member.fullName || member.email}</p>
                    <p className="text-xs text-[#94a3b8]">{member.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {member.isGodMode ? (
                      <span className="inline-flex rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-300">
                        {roleLabel(member.role)}
                      </span>
                    ) : (
                      <select
                        value={member.role}
                        disabled={rowLoading === member.userId}
                        onChange={(event) =>
                          member.userId
                            ? handleRoleChange(member.userId, event.target.value as AdminRole)
                            : undefined
                        }
                        className="rounded-lg border border-[#334155] bg-[#1e2433] px-2 py-1 text-sm text-white"
                      >
                        <option value="operator">Operator</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {member.isGodMode ? (
                      "Environment config"
                    ) : member.grantedAt ? (
                      <>
                        {new Date(member.grantedAt).toLocaleDateString()}
                        {member.grantedByEmail ? (
                          <span className="block text-xs text-[#64748b]">by {member.grantedByEmail}</span>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {member.isGodMode || !member.userId ? (
                      <span className="text-[#64748b]">Locked</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemove(member.userId!)}
                        disabled={rowLoading === member.userId}
                        className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {rowLoading === member.userId ? "Removing…" : "Remove access"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
