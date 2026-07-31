import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/business/active-business";
import { enqueueCustomerImportJob, getCustomerImportJob, listCustomerImportJobs } from "@/lib/customers/import-queue";
import { importCustomers } from "@/lib/customers/storage";
import {
  countCsvDataRows,
  enforceImportRowLimit,
  parseCustomerCsv,
  parseCustomerJson,
  validateCsvForImport,
} from "@/lib/customers/parse-import";
import { LARGE_IMPORT_ROW_THRESHOLD } from "@/lib/review-requests/bulk-config";
import { getUser } from "@/lib/supabase/server";

function shouldUseAsyncImport(rowCount: number, asyncRequested?: boolean): boolean {
  return asyncRequested === true || rowCount >= LARGE_IMPORT_ROW_THRESHOLD;
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getActiveBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  try {
    const jobs = await listCustomerImportJobs(business.businessId, user.id, 5);
    return NextResponse.json({ jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list import jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getActiveBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
      const text = await request.text();
      const validation = validateCsvForImport(text);
      if (!validation.ok) {
        return NextResponse.json(
          { error: validation.errors[0] ?? "Invalid CSV", errors: validation.errors },
          { status: 400 }
        );
      }

      const dataRowCount = countCsvDataRows(text);
      const rowLimitError = enforceImportRowLimit(dataRowCount);
      if (rowLimitError) {
        return NextResponse.json({ error: rowLimitError }, { status: 400 });
      }

      if (shouldUseAsyncImport(dataRowCount)) {
        const jobId = await enqueueCustomerImportJob({
          userId: user.id,
          businessId: business.businessId,
          importFormat: "csv",
          rawCsv: text,
          totalRows: dataRowCount,
        });
        const job = await getCustomerImportJob(jobId, user.id);
        return NextResponse.json({
          async: true,
          jobId,
          job,
          status: "pending",
          totalRows: dataRowCount,
        });
      }

      const parsed = parseCustomerCsv(text);
      const result = await importCustomers(user.id, business.businessId, parsed.rows);
      return NextResponse.json({
        ...result,
        skipped: parsed.skipped,
        parseErrors: parsed.errors,
        async: false,
        largeImport: parsed.rows.length >= LARGE_IMPORT_ROW_THRESHOLD,
      });
    }

    const body = (await request.json()) as {
      csv?: string;
      customers?: unknown[];
      async?: boolean;
    };

    if (body.csv) {
      const validation = validateCsvForImport(body.csv);
      if (!validation.ok) {
        return NextResponse.json(
          { error: validation.errors[0] ?? "Invalid CSV", errors: validation.errors },
          { status: 400 }
        );
      }

      const dataRowCount = countCsvDataRows(body.csv);
      const rowLimitError = enforceImportRowLimit(dataRowCount);
      if (rowLimitError) {
        return NextResponse.json({ error: rowLimitError }, { status: 400 });
      }

      if (shouldUseAsyncImport(dataRowCount, body.async)) {
        const jobId = await enqueueCustomerImportJob({
          userId: user.id,
          businessId: business.businessId,
          importFormat: "csv",
          rawCsv: body.csv,
          totalRows: dataRowCount,
        });
        const job = await getCustomerImportJob(jobId, user.id);
        return NextResponse.json({
          async: true,
          jobId,
          job,
          status: "pending",
          totalRows: dataRowCount,
        });
      }

      const parsed = parseCustomerCsv(body.csv);
      const result = await importCustomers(user.id, business.businessId, parsed.rows);
      return NextResponse.json({
        ...result,
        skipped: parsed.skipped,
        parseErrors: parsed.errors,
        async: false,
        largeImport: parsed.rows.length >= LARGE_IMPORT_ROW_THRESHOLD,
      });
    }

    if (body.customers) {
      const parsed = parseCustomerJson(body.customers);
      if (parsed.rows.length === 0) {
        return NextResponse.json(
          { error: parsed.errors[0] ?? "No valid customers", errors: parsed.errors },
          { status: 400 }
        );
      }

      const rowLimitError = enforceImportRowLimit(parsed.rows.length);
      if (rowLimitError) {
        return NextResponse.json({ error: rowLimitError }, { status: 400 });
      }

      if (shouldUseAsyncImport(parsed.rows.length, body.async)) {
        const jobId = await enqueueCustomerImportJob({
          userId: user.id,
          businessId: business.businessId,
          importFormat: "json",
          rawJson: body.customers as unknown[],
          totalRows: Array.isArray(body.customers) ? body.customers.length : parsed.rows.length,
        });
        const job = await getCustomerImportJob(jobId, user.id);
        return NextResponse.json({
          async: true,
          jobId,
          job,
          status: "pending",
          totalRows: Array.isArray(body.customers) ? body.customers.length : parsed.rows.length,
        });
      }

      const result = await importCustomers(user.id, business.businessId, parsed.rows);
      return NextResponse.json({
        ...result,
        skipped: parsed.skipped,
        parseErrors: parsed.errors,
        async: false,
        largeImport: parsed.rows.length >= LARGE_IMPORT_ROW_THRESHOLD,
      });
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
