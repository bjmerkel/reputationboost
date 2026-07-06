import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
} from "@/lib/customers/storage";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const url = new URL(request.url);
  const eligibleOnly = url.searchParams.get("eligible") === "1";
  const limit = Number(url.searchParams.get("limit") ?? "100");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  try {
    const { customers, total } = await listCustomers(user.id, business.businessId, {
      eligibleOnly,
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return NextResponse.json({ customers, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load customers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      serviceNotes?: string;
      lastServiceDate?: string;
    };

    if (!body.phone?.trim()) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const customer = await createCustomer(user.id, business.businessId, {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      email: body.email,
      serviceNotes: body.serviceNotes,
      lastServiceDate: body.lastServiceDate,
      source: "manual",
    });

    return NextResponse.json({ customer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create customer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const url = new URL(request.url);
  const customerId = url.searchParams.get("id");
  if (!customerId) {
    return NextResponse.json({ error: "Customer id is required" }, { status: 400 });
  }

  try {
    await deleteCustomer(user.id, business.businessId, customerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete customer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
