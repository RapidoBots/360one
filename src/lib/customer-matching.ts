// NANP (US/Canada) numbers are 10 digits; the widget's country-code phone
// input produces an 11-digit "1" + 10-digit form, but staff-entered numbers
// (internal booking, walk-in, waitlist) never carry a country code. Stripping
// a leading NANP "1" keeps both forms matching to the same customer.
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function customerMatchKey(
  input: { phone?: string | null; email?: string | null }
): { field: "phone"; value: string } | { field: "email"; value: string } | null {
  const phone = input.phone ? normalizePhone(input.phone) : "";
  if (phone) return { field: "phone", value: phone };

  const email = input.email ? normalizeEmail(input.email) : "";
  if (email) return { field: "email", value: email };

  return null;
}
