import { NextResponse } from "next/server";
import { optOutCustomerAdmin } from "@/lib/customers/storage-admin";
import { parseUnsubscribeToken } from "@/lib/email/unsubscribe";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return new NextResponse(unsubscribePage("Invalid unsubscribe link."), { status: 400 });
  }

  const parsed = parseUnsubscribeToken(token);
  if (!parsed) {
    return new NextResponse(unsubscribePage("This unsubscribe link is invalid or expired."), {
      status: 400,
    });
  }

  try {
    await optOutCustomerAdmin(parsed.customerId, parsed.businessId);
    return new NextResponse(
      unsubscribePage(
        "You have been unsubscribed from future review requests.",
        "You will not receive further review request emails or texts from this business."
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch {
    return new NextResponse(unsubscribePage("We could not process your unsubscribe request."), {
      status: 500,
    });
  }
}

function unsubscribePage(title: string, detail?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #202124; margin: 0; padding: 48px 16px; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; border: 1px solid #dadce0; border-radius: 12px; padding: 32px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { margin: 0; line-height: 1.6; color: #5f6368; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
