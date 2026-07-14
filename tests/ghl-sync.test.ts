import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildGhlContactPayload, syncContactToGhl } from "@/lib/ghl-sync";

describe("buildGhlContactPayload", () => {
  it("keeps the guest name", () => {
    const payload = buildGhlContactPayload({ name: "Taylor Guest", email: null, phone: null });
    expect(payload.name).toBe("Taylor Guest");
  });

  it("omits email and phone when null", () => {
    const payload = buildGhlContactPayload({ name: "Taylor Guest", email: null, phone: null });
    expect(payload.email).toBeUndefined();
    expect(payload.phone).toBeUndefined();
  });

  it("includes email and phone when present", () => {
    const payload = buildGhlContactPayload({
      name: "Taylor Guest",
      email: "taylor@example.com",
      phone: "555-000-1111",
    });
    expect(payload.email).toBe("taylor@example.com");
    expect(payload.phone).toBe("555-000-1111");
  });
});

describe("syncContactToGhl", () => {
  const guest = { name: "Taylor Guest", email: "taylor@example.com", phone: "555-000-1111" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when ghlLocationId is missing", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await syncContactToGhl({ ghlLocationId: null, ghlApiKey: "key" }, guest);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does nothing when ghlApiKey is missing", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await syncContactToGhl({ ghlLocationId: "loc123", ghlApiKey: null }, guest);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the contact to GHL when both credentials are present", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    await syncContactToGhl({ ghlLocationId: "loc123", ghlApiKey: "key" }, guest);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://services.leadconnectorhq.com/contacts/",
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
    });
  });

  it("swallows a fetch failure instead of throwing", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      syncContactToGhl({ ghlLocationId: "loc123", ghlApiKey: "key" }, guest)
    ).resolves.toBeUndefined();
  });
});
