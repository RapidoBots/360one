export type GhlCredentials = { ghlLocationId: string | null; ghlApiKey: string | null };
export type GhlGuest = {
  name: string;
  email: string | null;
  phone: string | null;
  startsAt: Date;
  partySize: number;
  restaurantName: string;
  timeZone: string;
};

function formatReservationDate(startsAt: Date, timeZone: string): string {
  return startsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone });
}

function formatReservationTime(startsAt: Date, timeZone: string): string {
  return startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone });
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
      { key: "date", field_value: formatReservationDate(guest.startsAt, guest.timeZone) },
      { key: "time", field_value: formatReservationTime(guest.startsAt, guest.timeZone) },
      { key: "party_size", field_value: String(guest.partySize) },
      { key: "restaurant_name", field_value: guest.restaurantName },
    ],
  };
}

// A repeat guest's automation should fire on every booking, not just their
// first-ever one. GHL's "Tag Added" trigger only fires on an absent ->
// present transition, so we remove then re-add this tag on every sync --
// restaurants should set their workflow trigger to "Tag Added:
// new-reservation" rather than "Contact Created" (which, by design, can
// only ever fire once per contact).
const GHL_RESERVATION_TAG = "new-reservation";

function ghlHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  };
}

export async function syncContactToGhl(credentials: GhlCredentials, guest: GhlGuest): Promise<void> {
  if (!credentials.ghlLocationId || !credentials.ghlApiKey) return;
  // GHL's upsert endpoint identifies/dedupes contacts by email or phone and
  // rejects a payload with neither (400 "Pass at least one of number,
  // email"). Both fields are optional on our own reservation forms, so a
  // name-only guest has nothing to sync -- skip rather than let every such
  // booking log a guaranteed-failing request.
  if (!guest.email && !guest.phone) return;
  const { ghlLocationId, ghlApiKey } = credentials;
  try {
    // Upsert, not create: a plain create-contact call fails once the guest
    // already exists (from an earlier reservation), which silently dropped
    // both the contact-info update AND any automation tied to that call.
    const upsertRes = await fetch("https://services.leadconnectorhq.com/contacts/upsert", {
      method: "POST",
      headers: ghlHeaders(ghlApiKey),
      body: JSON.stringify({ locationId: ghlLocationId, ...buildGhlContactPayload(guest) }),
    });
    if (!upsertRes.ok) {
      console.error("GHL contact upsert failed", upsertRes.status, await upsertRes.text());
      return;
    }
    const data: { contact?: { id?: string }; id?: string } = await upsertRes.json();
    const contactId = data.contact?.id ?? data.id;
    if (!contactId) {
      console.error("GHL contact upsert returned no contact id", data);
      return;
    }

    await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/tags`, {
      method: "DELETE",
      headers: ghlHeaders(ghlApiKey),
      body: JSON.stringify({ tags: [GHL_RESERVATION_TAG] }),
    });
    await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/tags`, {
      method: "POST",
      headers: ghlHeaders(ghlApiKey),
      body: JSON.stringify({ tags: [GHL_RESERVATION_TAG] }),
    });
  } catch (error) {
    console.error("GHL contact sync failed", error);
  }
}
