export type GhlCredentials = { ghlLocationId: string | null; ghlApiKey: string | null };
export type GhlGuest = { name: string; email: string | null; phone: string | null };

export function buildGhlContactPayload(guest: GhlGuest): Record<string, unknown> {
  return { name: guest.name, email: guest.email || undefined, phone: guest.phone || undefined };
}

export async function syncContactToGhl(credentials: GhlCredentials, guest: GhlGuest): Promise<void> {
  if (!credentials.ghlLocationId || !credentials.ghlApiKey) return;
  try {
    await fetch("https://services.leadconnectorhq.com/contacts/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.ghlApiKey}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ locationId: credentials.ghlLocationId, ...buildGhlContactPayload(guest) }),
    });
  } catch (error) {
    console.error("GHL contact sync failed", error);
  }
}
