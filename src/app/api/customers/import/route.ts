import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { importCustomers } from "@/lib/customers/storage";
import { parseCustomerCsv, parseCustomerJson } from "@/lib/customers/parse-import";
import { getUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
      const text = await request.text();
      const parsed = parseCustomerCsv(text);

      if (parsed.rows.length === 0) {
        return NextResponse.json(
          { error: parsed.errors[0] ?? "No valid rows found in CSV", errors: parsed.errors },
          { status: 400 }
        );
      }

      const result = await importCustomers(user.id, business.businessId, parsed.rows);
      return NextResponse.json({ ...result, skipped: parsed.skipped, parseErrors: parsed.errors });
    }

    const body = (await request.json()) as { csv?: string; customers?: unknown[] };

    if (body.csv) {
      const parsed = parseCustomerCsv(body.csv);
      if (parsed.rows.length === 0) {
        return NextResponse.json(
          { error: parsed.errors[0] ?? "No valid rows found", errors: parsed.errors },
          { status: 400 }
        );
      }
      const result = await importCustomers(user.id, business.businessId, parsed.rows);
      return NextResponse.json({ ...result, skipped: parsed.skipped, parseErrors: parsed.errors });
    }

    if (body.customers) {
      const parsed = parseCustomerJson(body.customers);
      if (parsed.rows.length === 0) {
        return NextResponse.json(
          { error: parsed.errors[0] ?? "No valid customers", errors: parsed.errors },
          { status: 400 }
        );
      }
      const result = await importCustomers(user.id, business.businessId, parsed.rows);
      return NextResponse.json({ ...result, skipped: parsed.skipped, parseErrors: parsed.errors });
    }

    return NextResponse.json(
      { error: "Provide csv text, customers array, or text/csv body" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
