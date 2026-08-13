import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildGhlContactPayload, syncContactToGhl } from "@/lib/ghl-sync";

const RESERVATION_GUEST = {
  name: "Taylor Guest",
  email: "taylor@example.com",
  phone: "555-000-1111",
  startsAt: new Date("2026-08-01T23:00:00Z"), // 7:00 PM in America/Toronto (EDT, UTC-4)
  partySize: 4,
  restaurantName: "The Blue Fork",
  timeZone: "America/Toronto",
};

describe("buildGhlContactPayload", () => {
  it("keeps the guest name", () => {
    const payload = buildGhlContactPayload({ ...RESERVATION_GUEST, email: null, phone: null });
    expect(payload.name).toBe("Taylor Guest");
  });

  it("omits email and phone when null", () => {
    const payload = buildGhlContactPayload({ ...RESERVATION_GUEST, email: null, phone: null });
    expect(payload.email).toBeUndefined();
    expect(payload.phone).toBeUndefined();
  });

  it("includes email and phone when present", () => {
    const payload = buildGhlContactPayload(RESERVATION_GUEST);
    expect(payload.email).toBe("taylor@example.com");
    expect(payload.phone).toBe("555-000-1111");
  });

  it("includes reservation details as custom fields, human-readable", () => {
    const payload = buildGhlContactPayload(RESERVATION_GUEST);
    expect(payload.customFields).toEqual([
      { key: "date", field_value: "August 1, 2026" },
      { key: "time", field_value: "7:00 PM" },
      { key: "party_size", field_value: "4" },
      { key: "restaurant_name", field_value: "The Blue Fork" },
    ]);
  });
});

describe("syncContactToGhl", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when ghlLocationId is missing", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await syncContactToGhl({ ghlLocationId: null, ghlApiKey: "key" }, RESERVATION_GUEST);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does nothing when ghlApiKey is missing", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await syncContactToGhl({ ghlLocationId: "loc123", ghlApiKey: null }, RESERVATION_GUEST);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does nothing when the guest has neither email nor phone (GHL's upsert requires one)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await syncContactToGhl(
      { ghlLocationId: "loc123", ghlApiKey: "key" },
      { ...RESERVATION_GUEST, email: null, phone: null }
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("upserts the contact to GHL when both credentials are present", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ contact: { id: "ghl_contact_1" } }), { status: 200 }));
    await syncContactToGhl({ ghlLocationId: "loc123", ghlApiKey: "key" }, RESERVATION_GUEST);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://services.leadconnectorhq.com/contacts/upsert",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer key",
          Version: "2021-07-28",
        }),
      })
    );
    const [, options] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse(options!.body as string);
    expect(body).toEqual({
      locationId: "loc123",
      name: "Taylor Guest",
      email: "taylor@example.com",
      phone: "555-000-1111",
      customFields: [
        { key: "date", field_value: "August 1, 2026" },
        { key: "time", field_value: "7:00 PM" },
        { key: "party_size", field_value: "4" },
        { key: "restaurant_name", field_value: "The Blue Fork" },
      ],
    });
  });

  it("removes then re-adds the reservation tag, so a repeat guest's automation fires again", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ contact: { id: "ghl_contact_1" } }), { status: 200 }));
    await syncContactToGhl({ ghlLocationId: "loc123", ghlApiKey: "key" }, RESERVATION_GUEST);

    expect(fetchSpy).toHaveBeenCalledTimes(3);

    const [removeUrl, removeOptions] = fetchSpy.mock.calls[1]!;
    expect(removeUrl).toBe("https://services.leadconnectorhq.com/contacts/ghl_contact_1/tags");
    expect(removeOptions).toMatchObject({ method: "DELETE" });
    expect(JSON.parse(removeOptions!.body as string)).toEqual({ tags: ["new-reservation"] });

    const [addUrl, addOptions] = fetchSpy.mock.calls[2]!;
    expect(addUrl).toBe("https://services.leadconnectorhq.com/contacts/ghl_contact_1/tags");
    expect(addOptions).toMatchObject({ method: "POST" });
    expect(JSON.parse(addOptions!.body as string)).toEqual({ tags: ["new-reservation"] });
  });

  it("logs and stops if the upsert response has no contact id, without touching tags", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await syncContactToGhl({ ghlLocationId: "loc123", ghlApiKey: "key" }, RESERVATION_GUEST);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("swallows a fetch failure instead of throwing", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      syncContactToGhl({ ghlLocationId: "loc123", ghlApiKey: "key" }, RESERVATION_GUEST)
    ).resolves.toBeUndefined();
  });
});
