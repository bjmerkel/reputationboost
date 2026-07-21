import { NextResponse } from "next/server";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";
import {
  listUnreadNotificationsForUser,
  markNotificationsReadForUser,
} from "@/audit/storage-notifications";
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

  const businessId = await getBusinessIdForSlug(user.id, clientId);
  if (!businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const notifications = await listUnreadNotificationsForUser(user.id, businessId);
  return NextResponse.json({ notifications });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    notificationIds?: string[];
  };

  if (!body.clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const businessId = await getBusinessIdForSlug(user.id, body.clientId);
  if (!businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const marked = await markNotificationsReadForUser(
    user.id,
    businessId,
    body.notificationIds
  );
  return NextResponse.json({ marked });
}
