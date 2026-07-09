export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
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
