import { NextResponse } from "next/server";
import { loadBusinessConfig, updateAutopilotMode } from "@/audit/businesses";
import { parseAutopilotMode } from "@/audit/autopilot/modes";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const client = await loadBusinessConfig(user.id, clientId);
  return NextResponse.json({
    autopilotMode: client.autopilotMode ?? "manual",
  });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    autopilotMode?: string;
  };

  if (!body.clientId || !body.autopilotMode) {
    return NextResponse.json(
      { error: "clientId and autopilotMode are required" },
      { status: 400 }
    );
  }

  const businessId = await getBusinessIdForSlug(user.id, body.clientId);
  if (!businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const mode = parseAutopilotMode(body.autopilotMode);
  const client = await updateAutopilotMode(user.id, businessId, mode);
  return NextResponse.json({ autopilotMode: client.autopilotMode ?? mode });
}
