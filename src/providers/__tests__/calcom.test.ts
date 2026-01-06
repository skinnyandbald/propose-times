import { describe, it, expect, vi, beforeEach } from "vitest";
import { calcomProvider } from "../calcom";
import type { ProviderConfig, LinkInfo, TimeSlot } from "../../types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("calcomProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("fetchSlots", () => {
    const config: ProviderConfig = {
      calcomUsername: "testuser",
      calcomEventSlug: "meeting",
    };
    const startDate = new Date("2026-01-07");
    const endDate = new Date("2026-01-10");

    it("parses Cal.com slots response correctly", async () => {
      // Cal.com v2 returns slots grouped by date
      const mockResponse = {
        status: "success",
        data: {
          "2026-01-07": [
            { start: "2026-01-07T10:00:00Z" },
            { start: "2026-01-07T11:00:00Z" },
          ],
          "2026-01-08": [{ start: "2026-01-08T14:00:00Z" }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await calcomProvider.fetchSlots(config, startDate, endDate);

      expect(result.slots).toHaveLength(3);
      expect(result.slots[0].start_at).toBe("2026-01-07T10:00:00Z");
      expect(result.slots[1].start_at).toBe("2026-01-07T11:00:00Z");
      expect(result.slots[2].start_at).toBe("2026-01-08T14:00:00Z");
    });

    it("handles empty slots response", async () => {
      const mockResponse = {
        status: "success",
        data: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await calcomProvider.fetchSlots(config, startDate, endDate);

      expect(result.slots).toHaveLength(0);
    });

    it("calculates end_at based on 30-minute default duration", async () => {
      const mockResponse = {
        status: "success",
        data: {
          "2026-01-07": [{ start: "2026-01-07T10:00:00Z" }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await calcomProvider.fetchSlots(config, startDate, endDate);

      expect(result.slots[0].end_at).toBe("2026-01-07T10:30:00.000Z");
    });

    it("creates synthetic LinkInfo", async () => {
      const mockResponse = {
        status: "success",
        data: { "2026-01-07": [{ start: "2026-01-07T10:00:00Z" }] },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await calcomProvider.fetchSlots(config, startDate, endDate);

      expect(result.linkInfo.id).toBe("testuser/meeting");
      expect(result.linkInfo.slug).toBe("meeting");
      expect(result.linkInfo.durations).toEqual([15, 30, 45, 60]);
      expect(result.linkInfo.defaultDuration).toBe(30);
    });

    it("throws error when username is missing", async () => {
      const badConfig: ProviderConfig = {
        calcomEventSlug: "meeting",
      };

      await expect(
        calcomProvider.fetchSlots(badConfig, startDate, endDate)
      ).rejects.toThrow("Cal.com username and event slug are required");
    });

    it("throws error when event slug is missing", async () => {
      const badConfig: ProviderConfig = {
        calcomUsername: "testuser",
      };

      await expect(
        calcomProvider.fetchSlots(badConfig, startDate, endDate)
      ).rejects.toThrow("Cal.com username and event slug are required");
    });

    it("throws error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not found",
      });

      await expect(
        calcomProvider.fetchSlots(config, startDate, endDate)
      ).rejects.toThrow("Cal.com API error: 404 - Not found");
    });

    it("throws error on invalid JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "not valid json",
      });

      await expect(
        calcomProvider.fetchSlots(config, startDate, endDate)
      ).rejects.toThrow("Invalid JSON from Cal.com");
    });

    it("uses correct API version header", async () => {
      const mockResponse = { status: "success", data: {} };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
      });

      await calcomProvider.fetchSlots(config, startDate, endDate);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "cal-api-version": "2024-09-04",
          }),
        })
      );
    });
  });

  describe("generateBookingUrl", () => {
    const config: ProviderConfig = {
      calcomUsername: "testuser",
      calcomEventSlug: "meeting",
    };
    const linkInfo: LinkInfo = {
      id: "testuser/meeting",
      slug: "meeting",
      durations: [15, 30, 45, 60],
      defaultDuration: 30,
    };
    const slot: TimeSlot = {
      start_at: "2026-01-07T10:00:00Z",
      end_at: "2026-01-07T10:30:00Z",
    };

    it("generates booker URL when bookerUrl is provided", () => {
      const url = calcomProvider.generateBookingUrl(
        config,
        linkInfo,
        slot,
        "America/New_York",
        "https://booker.example.com",
        30
      );

      expect(url).toContain("https://booker.example.com/book?");
      expect(url).toContain("provider=calcom");
      expect(url).toContain("username=testuser");
      expect(url).toContain("event_slug=meeting");
      expect(url).toContain("duration=30");
      expect(url).toContain("tz=America%2FNew_York");
    });

    it("generates direct Cal.com URL when bookerUrl is not provided", () => {
      const url = calcomProvider.generateBookingUrl(
        config,
        linkInfo,
        slot,
        "America/New_York",
        undefined,
        30
      );

      expect(url).toContain("https://cal.com/testuser/meeting");
      expect(url).toContain("date=2026-01-07");
      expect(url).toContain("slot=");
    });
  });

  describe("getFallbackUrl", () => {
    it("returns direct Cal.com URL", () => {
      const config: ProviderConfig = {
        calcomUsername: "testuser",
        calcomEventSlug: "meeting",
      };

      const url = calcomProvider.getFallbackUrl(config);

      expect(url).toBe("https://cal.com/testuser/meeting");
    });
  });
});
