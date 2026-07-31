import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_SEGMENTS, countUsersInSegment } from "@/lib/admin/segments";
import { getAdminDashboardData } from "@/lib/admin/overview";
import { getAllUserSummaries } from "@/lib/admin/users";
import { sendEmail, isResendConfigured } from "@/lib/email/resend";
import { gradeLabel } from "@/lib/scores/grade";
import type { HealthGrade } from "@/audit/types";

export interface AdminDigestResult {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  recipientCount: number;
  weekStart: string;
}

function getWeekStart(date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function parseBootstrapEmails(): string[] {
  const raw = process.env.ADMIN_BOOTSTRAP_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminDigestRecipients(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id, role")
    .in("role", ["operator", "superadmin"]);

  const emails = new Set<string>(parseBootstrapEmails());

  if (!error && data && data.length > 0) {
    const userIds = data.map((row) => row.user_id as string);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    for (const profile of profiles ?? []) {
      const email = (profile.email as string | null)?.trim().toLowerCase();
      if (email) emails.add(email);
    }
  }

  return [...emails];
}

async function wasDigestSentThisWeek(weekStart: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_digest_sends")
    .select("week_start")
    .eq("week_start", weekStart)
    .maybeSingle();

  return !error && Boolean(data);
}

async function recordDigestSend(weekStart: string, recipientCount: number): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("admin_digest_sends").upsert({
    week_start: weekStart,
    recipient_count: recipientCount,
    sent_at: new Date().toISOString(),
  });
}

function buildDigestHtml(input: {
  overview: Awaited<ReturnType<typeof getAdminDashboardData>>["overview"];
  alerts: Awaited<ReturnType<typeof getAdminDashboardData>>["alerts"];
  segmentCounts: Array<{ label: string; count: number }>;
  weekStart: string;
}): { html: string; text: string } {
  const { overview, alerts, segmentCounts, weekStart } = input;
  const topAlerts = alerts.slice(0, 8);

  const gradeRows = (["healthy", "at_risk", "urgent"] as HealthGrade[])
    .map(
      (grade) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${gradeLabel(grade)}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${overview.gradeDistribution[grade]}</td></tr>`
    )
    .join("");

  const alertItems = topAlerts.length
    ? topAlerts
        .map(
          (alert) =>
            `<li style="margin-bottom:6px;"><strong>${alert.title}</strong> — ${alert.detail}</li>`
        )
        .join("")
    : "<li>No active alerts this week.</li>";

  const segmentItems = segmentCounts
    .filter((segment) => segment.count > 0)
    .map((segment) => `<li>${segment.label}: ${segment.count}</li>`)
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
  <h1 style="font-size:22px;margin-bottom:4px;">Reputation Boost — Weekly Admin Digest</h1>
  <p style="color:#6b7280;margin-top:0;">Week of ${weekStart}</p>

  <h2 style="font-size:16px;margin-top:24px;">Platform KPIs</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">Total users</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${overview.totalUsers}</td></tr>
    <tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">Avg health index</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${overview.avgHealthIndex ?? "—"}</td></tr>
    <tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">High churn risk</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${overview.highChurnRiskUsers}</td></tr>
    <tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">Active alerts</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${overview.alertCount}</td></tr>
    <tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">Pending tasks</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${overview.pendingTasks}</td></tr>
    <tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">Avg score</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${overview.avgScore ?? "—"}</td></tr>
  </table>

  <h2 style="font-size:16px;margin-top:24px;">Grade distribution</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">${gradeRows}</table>

  <h2 style="font-size:16px;margin-top:24px;">Smart segments</h2>
  <ul style="font-size:14px;padding-left:20px;">${segmentItems || "<li>No segment matches</li>"}</ul>

  <h2 style="font-size:16px;margin-top:24px;">Top alerts</h2>
  <ul style="font-size:14px;padding-left:20px;">${alertItems}</ul>

  <p style="margin-top:32px;font-size:13px;color:#6b7280;">
  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.reputationboost.com"}/admin">Open Command Center</a>
  · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.reputationboost.com"}/admin/outreach">Outreach queue</a>
  </p>
</body>
</html>`;

  const text = [
    `Reputation Boost — Weekly Admin Digest (week of ${weekStart})`,
    "",
    `Total users: ${overview.totalUsers}`,
    `Avg health index: ${overview.avgHealthIndex ?? "—"}`,
    `High churn risk: ${overview.highChurnRiskUsers}`,
    `Active alerts: ${overview.alertCount}`,
    `Pending tasks: ${overview.pendingTasks}`,
    `Avg score: ${overview.avgScore ?? "—"}`,
    "",
    "Top alerts:",
    ...topAlerts.map((alert) => `- ${alert.title}: ${alert.detail}`),
  ].join("\n");

  return { html, text };
}

export async function sendAdminWeeklyDigest(options?: {
  force?: boolean;
}): Promise<AdminDigestResult> {
  const weekStart = getWeekStart();

  if (!options?.force && (await wasDigestSentThisWeek(weekStart))) {
    return { sent: false, skipped: true, reason: "Already sent this week", recipientCount: 0, weekStart };
  }

  if (!isResendConfigured()) {
    return { sent: false, skipped: true, reason: "Resend not configured", recipientCount: 0, weekStart };
  }

  const recipients = await getAdminDigestRecipients();
  if (recipients.length === 0) {
    return { sent: false, skipped: true, reason: "No admin recipients", recipientCount: 0, weekStart };
  }

  const [dashboard, users] = await Promise.all([getAdminDashboardData(), getAllUserSummaries()]);
  const segmentCounts = ADMIN_SEGMENTS.map((segment) => ({
    label: segment.label,
    count: countUsersInSegment(users, segment.id),
  }));

  const { html, text } = buildDigestHtml({
    overview: dashboard.overview,
    alerts: dashboard.alerts,
    segmentCounts,
    weekStart,
  });

  let successCount = 0;
  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient,
      subject: `Reputation Boost admin digest — week of ${weekStart}`,
      html,
      text,
      tags: [{ name: "type", value: "admin-weekly-digest" }],
    });
    if (result.success) successCount += 1;
  }

  if (successCount > 0) {
    await recordDigestSend(weekStart, successCount);
  }

  return {
    sent: successCount > 0,
    skipped: false,
    recipientCount: successCount,
    weekStart,
    reason: successCount === 0 ? "All sends failed" : undefined,
  };
}
