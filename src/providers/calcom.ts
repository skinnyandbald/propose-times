import { format } from "date-fns";
import type {
  CalendarProvider,
  ProviderConfig,
  TimeSlot,
  LinkInfo,
  FetchSlotsResult,
} from "../types";

interface CalComSlot {
  time: string;
}

interface CalComSlotsResponse {
  status: string;
  data: {
    slots: Record<string, CalComSlot[]>;
  };
}

// Cal.com v2 slots API returns slots grouped by date
// Response: { status: "success", data: { slots: { "2024-01-15": [{ time: "2024-01-15T10:00:00Z" }] } } }

export const calcomProvider: CalendarProvider = {
  name: "Cal.com",

  async fetchSlots(
    config: ProviderConfig,
    startDate: Date,
    endDate: Date,
  ): Promise<FetchSlotsResult> {
    const { calcomUsername, calcomEventSlug } = config;

    if (!calcomUsername || !calcomEventSlug) {
      throw new Error("Cal.com username and event slug are required");
    }

    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");

    // Cal.com public slots API - no auth required
    const url = `https://api.cal.com/v2/slots?eventTypeSlug=${encodeURIComponent(calcomEventSlug)}&username=${encodeURIComponent(calcomUsername)}&start=${startStr}&end=${endStr}&timeZone=UTC`;

    console.log("Cal.com slots request:", url);

    const response = await fetch(url, {
      headers: {
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();
    console.log("Cal.com slots response:", response.status);

    if (!response.ok) {
      throw new Error(`Cal.com API error: ${response.status} - ${responseText}`);
    }

    let data: CalComSlotsResponse;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON from Cal.com: ${responseText}`);
    }

    // Convert Cal.com's grouped format to our flat TimeSlot array
    const slots: TimeSlot[] = [];
    const slotsData = data.data?.slots || {};

    for (const dateKey of Object.keys(slotsData)) {
      const daySlots = slotsData[dateKey];
      for (const slot of daySlots) {
        // Cal.com returns { time: "2024-01-15T10:00:00Z" }
        const startTime = slot.time;
        // Calculate end time (assume 30 min default, will be overridden by duration)
        const endTime = new Date(new Date(startTime).getTime() + 30 * 60 * 1000).toISOString();
        slots.push({
          start_at: startTime,
          end_at: endTime,
        });
      }
    }

    // Cal.com doesn't have a "link info" concept like SavvyCal
    // We create a synthetic one
    const linkInfo: LinkInfo = {
      id: `${calcomUsername}/${calcomEventSlug}`,
      slug: calcomEventSlug,
      durations: [15, 30, 45, 60], // Cal.com typically supports these
      defaultDuration: 30,
    };

    return { slots, linkInfo };
  },

  generateBookingUrl(
    config: ProviderConfig,
    _linkInfo: LinkInfo,
    slot: TimeSlot,
    timezone: string,
    bookerUrl: string | undefined,
    duration: number,
  ): string {
    const { calcomUsername, calcomEventSlug } = config;
    const slotDate = new Date(slot.start_at);

    // Use one-click booker if configured
    if (bookerUrl) {
      const params = new URLSearchParams({
        slot: slotDate.toISOString(),
        username: calcomUsername || "",
        event_slug: calcomEventSlug || "",
        duration: duration.toString(),
        tz: timezone,
        provider: "calcom",
      });
      return `${bookerUrl}/book?${params.toString()}`;
    }

    // Fallback: direct Cal.com link with slot pre-selected
    // Cal.com URL format: cal.com/{username}/{event}?date=2024-01-15&slot=2024-01-15T10:00:00
    const dateStr = format(slotDate, "yyyy-MM-dd");
    const slotTimeParam = slotDate.toISOString();
    return `https://cal.com/${calcomUsername}/${calcomEventSlug}?date=${dateStr}&slot=${encodeURIComponent(slotTimeParam)}`;
  },

  getFallbackUrl(config: ProviderConfig): string {
    return `https://cal.com/${config.calcomUsername}/${config.calcomEventSlug}`;
  },
};
