import { NextResponse } from "next/server";
import { demoClient } from "@/audit/clients";
import { listExecutionTasks } from "@/audit/storage-execution";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") ?? demoClient.id;
  const auditId = searchParams.get("auditId") ?? undefined;

  const tasks = await listExecutionTasks(user.id, clientId, auditId);
  return NextResponse.json({ tasks });
}
