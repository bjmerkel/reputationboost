import { normalizeEmail } from "@/lib/email/resend";
import { normalizePhoneE164 } from "@/lib/sms/phone";

export interface NormalizedCustomerContact {
  phone: string | null;
  email: string | null;
}

export function normalizeCustomerContact(input: {
  phone?: string | null;
  email?: string | null;
}): NormalizedCustomerContact {
  const phoneRaw = input.phone?.trim();
  const phone = phoneRaw ? normalizePhoneE164(phoneRaw) : null;
  if (phoneRaw && !phone) {
    throw new Error("Invalid phone number");
  }

  const emailRaw = input.email?.trim();
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !email) {
    throw new Error("Invalid email address");
  }

  if (!phone && !email) {
    throw new Error("Phone or email is required");
  }

  return { phone, email };
}

export function hasCustomerContact(customer: {
  phone?: string | null;
  email?: string | null;
}): boolean {
  const phone = customer.phone?.trim();
  if (phone && normalizePhoneE164(phone)) return true;
  const email = customer.email?.trim();
  if (email && normalizeEmail(email)) return true;
  return false;
}
