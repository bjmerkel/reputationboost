import { listCustomers } from "@/lib/customers/storage";
import type { CustomerKeywordHint } from "./customer-match";

const CUSTOMER_HINT_LIMIT = 500;

export async function loadCustomerKeywordHints(
  userId: string,
  businessId: string
): Promise<CustomerKeywordHint[]> {
  try {
    const { customers } = await listCustomers(userId, businessId, {
      limit: CUSTOMER_HINT_LIMIT,
    });
    return customers
      .filter((customer) => customer.service_notes?.trim())
      .map((customer) => ({
        first_name: customer.first_name,
        last_name: customer.last_name,
        service_notes: customer.service_notes,
      }));
  } catch {
    return [];
  }
}
