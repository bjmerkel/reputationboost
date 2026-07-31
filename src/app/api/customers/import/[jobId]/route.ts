import { NextResponse } from "next/server";
import { getCustomerImportJob } from "@/lib/customers/import-queue";
import { getUser } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;
  try {
    const job = await getCustomerImportJob(jobId, user.id);
    if (!job) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load import job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
