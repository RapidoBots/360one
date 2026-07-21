export type GhlCredentials = { ghlLocationId: string | null; ghlApiKey: string | null };
export type GhlGuest = {
  name: string;
  email: string | null;
  phone: string | null;
  startsAt: Date;
  partySize: number;
  restaurantName: string;
};

function formatReservationDate(startsAt: Date): string {
  return startsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatReservationTime(startsAt: Date): string {
  return startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function buildGhlContactPayload(guest: GhlGuest): Record<string, unknown> {
  return {
    name: guest.name,
    email: guest.email || undefined,
    phone: guest.phone || undefined,
    // Custom Fields must already exist (with these exact keys) in the
    // restaurant's GHL sub-account for their automation's merge tags
    // (e.g. {{contact.date}}) to pick these values up.
    customFields: [
      { key: "date", field_value: formatReservationDate(guest.startsAt) },
      { key: "time", field_value: formatReservationTime(guest.startsAt) },
      { key: "party_size", field_value: String(guest.partySize) },
      { key: "restaurant_name", field_value: guest.restaurantName },
    ],
  };
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
