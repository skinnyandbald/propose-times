import {
  Action,
  ActionPanel,
  Clipboard,
  Icon,
  showHUD,
  showToast,
  Toast,
  getPreferenceValues,
  Form,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { formatInTimeZone, utcToZonedTime } from "date-fns-tz";

interface Preferences {
  savvycalToken: string;
  savvycalLink: string;
  savvycalUsername: string;
  defaultTimezone: string;
  defaultDaysAhead: string;
  bookerUrl?: string;
}

interface TimeSlot {
  start_at: string;
  end_at: string;
  duration?: number;
  rank?: number;
}

interface SavvyCalSlotsResponse {
  data: TimeSlot[];
}

interface SchedulingLink {
  id: string;
  slug: string;
  name: string;
}

interface SavvyCalLinksResponse {
  data?: SchedulingLink[];
  entries?: SchedulingLink[];
}

const TIMEZONES = [
  { title: "Eastern (EST/EDT)", value: "America/New_York", abbr: "ET" },
  { title: "Central (CST/CDT)", value: "America/Chicago", abbr: "CT" },
  { title: "Mountain (MST/MDT)", value: "America/Denver", abbr: "MT" },
  { title: "Pacific (PST/PDT)", value: "America/Los_Angeles", abbr: "PT" },
  { title: "UTC", value: "UTC", abbr: "UTC" },
  { title: "London (GMT/BST)", value: "Europe/London", abbr: "GMT" },
  { title: "Paris (CET/CEST)", value: "Europe/Paris", abbr: "CET" },
  { title: "Tokyo (JST)", value: "Asia/Tokyo", abbr: "JST" },
  { title: "Sydney (AEST/AEDT)", value: "Australia/Sydney", abbr: "AEST" },
];

function getTimezoneAbbr(tzValue: string): string {
  const tz = TIMEZONES.find((t) => t.value === tzValue);
  return tz?.abbr || tzValue;
}

async function fetchLinkIdBySlug(token: string, slug: string): Promise<string> {
  const response = await fetch("https://api.savvycal.com/v1/links", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const responseText = await response.text();
  console.log("SavvyCal /v1/links response:", response.status, responseText);

  if (!response.ok) {
    throw new Error(
      `SavvyCal API error fetching links: ${response.status} - ${responseText}`,
    );
  }

  let data: SavvyCalLinksResponse;
  try {
    data = JSON.parse(responseText) as SavvyCalLinksResponse;
  } catch {
    throw new Error(`Invalid JSON from SavvyCal: ${responseText}`);
  }

  console.log("Parsed links data:", JSON.stringify(data, null, 2));

  // SavvyCal API returns { metadata: {...}, entries: [...] }
  const links =
    data.entries || data.data || (data as unknown as SchedulingLink[]);
  const link = Array.isArray(links) ? links.find((l) => l.slug === slug) : null;

  if (!link) {
    const availableSlugs = Array.isArray(links)
      ? links.map((l) => l.slug).join(", ")
      : "unknown structure";
    throw new Error(
      `No scheduling link found with slug "${slug}". Available: ${availableSlugs || "none"}`,
    );
  }

  return link.id;
}

interface FetchSlotsResult {
  slots: TimeSlot[];
  linkId: string;
}

async function fetchAvailableSlots(
  token: string,
  linkSlug: string,
  startDate: Date,
  endDate: Date,
): Promise<FetchSlotsResult> {
  const linkId = await fetchLinkIdBySlug(token, linkSlug);

  // SavvyCal requires ISO-8601 timestamps in UTC (e.g., 2024-01-20T00:00:00Z)
  const fromDate = new Date(startDate);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(endDate);
  toDate.setHours(23, 59, 59, 999);

  const response = await fetch(
    `https://api.savvycal.com/v1/links/${linkId}/slots?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  const responseText = await response.text();
  console.log(
    "SavvyCal slots response:",
    response.status,
    responseText.substring(0, 500),
  );

  if (!response.ok) {
    throw new Error(`SavvyCal API error: ${response.status} - ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Invalid JSON from SavvyCal slots: ${responseText}`);
  }

  // Handle response: direct array OR { data: [...] } OR { entries: [...] }
  const slots = Array.isArray(data) ? data : data.data || data.entries || [];
  console.log("Parsed slots count:", slots.length);
  return { slots, linkId };
}

interface TimeWindow {
  start: Date;
  end: Date;
}

function groupSlotsByDay(
  slots: TimeSlot[],
  timezone: string,
): Map<string, TimeSlot[]> {
  const grouped = new Map<string, TimeSlot[]>();

  for (const slot of slots) {
    if (!slot.start_at) continue; // Skip invalid slots
    const slotDate = new Date(slot.start_at);
    if (isNaN(slotDate.getTime())) continue; // Skip invalid dates

    const zonedDate = utcToZonedTime(slotDate, timezone);
    const dayKey = format(zonedDate, "yyyy-MM-dd");

    if (!grouped.has(dayKey)) {
      grouped.set(dayKey, []);
    }
    grouped.get(dayKey)!.push(slot);
  }

  return grouped;
}

// Merge consecutive slots into time windows
function mergeIntoWindows(slots: TimeSlot[]): TimeWindow[] {
  if (slots.length === 0) return [];

  // Sort by start time
  const sorted = [...slots].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );

  const windows: TimeWindow[] = [];
  let currentWindow: TimeWindow = {
    start: new Date(sorted[0].start_at),
    end: new Date(sorted[0].end_at),
  };

  for (let i = 1; i < sorted.length; i++) {
    const slotStart = new Date(sorted[i].start_at);
    const slotEnd = new Date(sorted[i].end_at);

    // If this slot starts at or before current window ends, extend the window
    if (slotStart.getTime() <= currentWindow.end.getTime()) {
      currentWindow.end = new Date(
        Math.max(currentWindow.end.getTime(), slotEnd.getTime()),
      );
    } else {
      // Gap found - save current window and start new one
      windows.push(currentWindow);
      currentWindow = { start: slotStart, end: slotEnd };
    }
  }

  // Don't forget the last window
  windows.push(currentWindow);

  return windows;
}

function formatTimeWindow(window: TimeWindow, timezone: string): string {
  const startTime = formatInTimeZone(
    window.start,
    timezone,
    "h:mma",
  ).toLowerCase();
  const endTime = formatInTimeZone(window.end, timezone, "h:mma").toLowerCase();
  return `${startTime} - ${endTime}`;
}

function generateWindowDeepLink(
  username: string,
  linkSlug: string,
  linkId: string,
  window: TimeWindow,
  timezone: string,
  bookerUrl?: string,
  duration: number = 30,
): string {
  // If booker URL is configured, use one-click booking
  if (bookerUrl) {
    const params = new URLSearchParams({
      slot: window.start.toISOString(),
      link_id: linkId,
      duration: duration.toString(),
      tz: timezone,
    });
    return `${bookerUrl}/book?${params.toString()}`;
  }

  // Fallback: SavvyCal only supports 'from' param to jump to a date (not pre-select a slot)
  const dateStr = format(window.start, "yyyy-MM-dd");
  return `https://savvycal.com/${username}/${linkSlug}?from=${dateStr}&time_zone=${encodeURIComponent(timezone)}`;
}

function generateMessage(
  slots: TimeSlot[],
  timezone: string,
  clickableSlots: boolean,
  username: string,
  linkSlug: string,
  linkId: string,
  bookerUrl?: string,
): string {
  const tzAbbr = getTimezoneAbbr(timezone);
  const groupedSlots = groupSlotsByDay(slots, timezone);

  const lines: string[] = [
    `Would any of these time windows work for a 30 min meeting (${tzAbbr})?`,
  ];

  const sortedDays = Array.from(groupedSlots.keys()).sort();

  for (const dayKey of sortedDays) {
    const daySlots = groupedSlots.get(dayKey)!;
    const zonedDate = utcToZonedTime(new Date(daySlots[0].start_at), timezone);
    const dayLabel = format(zonedDate, "EEE, MMM d");

    // Merge consecutive slots into windows
    const windows = mergeIntoWindows(daySlots);

    // Show up to 3 windows per day
    const displayWindows = windows.slice(0, 3);

    const windowStrings = displayWindows.map((window) => {
      const windowStr = formatTimeWindow(window, timezone);
      if (clickableSlots) {
        const link = generateWindowDeepLink(
          username,
          linkSlug,
          linkId,
          window,
          timezone,
          bookerUrl,
        );
        return `<a href="${link}">${windowStr}</a>`;
      }
      return windowStr;
    });

    lines.push(`• ${dayLabel}: ${windowStrings.join(", ")}`);
  }

  lines.push("");
  lines.push(
    `Feel free to use this booking page if that's easier (also contains more availabilities):`,
  );
  lines.push(`https://savvycal.com/${username}/${linkSlug}`);

  return lines.join("\n");
}

// Normalize date for comparison (strip time component)
function normalizeDate(d: Date): Date {
  const normalized = new Date(d);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const defaultDays = parseInt(preferences.defaultDaysAhead) || 10;

  // Fresh dates on every render
  const today = normalizeDate(new Date());
  const defaultEnd = addDays(today, defaultDays);

  const [startDate, setStartDate] = useState<Date | null>(today);
  const [endDate, setEndDate] = useState<Date | null>(defaultEnd);
  const [timezone, setTimezone] = useState(preferences.defaultTimezone);
  const [clickableSlots, setClickableSlots] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Reset to fresh dates on mount
  useEffect(() => {
    const freshToday = normalizeDate(new Date());
    setStartDate(freshToday);
    setEndDate(addDays(freshToday, defaultDays));
  }, []);

  const handleSubmit = async () => {
    if (!startDate || !endDate) return;

    setIsLoading(true);

    try {
      const { slots, linkId } = await fetchAvailableSlots(
        preferences.savvycalToken,
        preferences.savvycalLink,
        startDate,
        endDate,
      );

      if (slots.length === 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "No available slots",
          message: "No availability found in the selected date range",
        });
        setIsLoading(false);
        return;
      }

      const htmlMessage = generateMessage(
        slots,
        timezone,
        clickableSlots,
        preferences.savvycalUsername,
        preferences.savvycalLink,
        linkId,
        preferences.bookerUrl,
      );

      // Also generate plain text version (strip HTML tags)
      const plainTextMessage = generateMessage(
        slots,
        timezone,
        false, // No clickable slots for plain text
        preferences.savvycalUsername,
        preferences.savvycalLink,
        linkId,
        preferences.bookerUrl,
      );

      // Copy as rich text (HTML) with plain text fallback
      await Clipboard.copy({
        text: plainTextMessage,
        html: htmlMessage.replace(/\n/g, "<br>").replace(/• /g, "• "),
      });
      await showHUD("✓ Meeting times copied to clipboard!");
    } catch (error) {
      console.error("Error fetching slots:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch availability",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const dateRangeText =
    startDate && endDate
      ? `${format(startDate, "EEE, MMM d")} → ${format(endDate, "EEE, MMM d, yyyy")}`
      : "Select dates";

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Generate & Copy Message"
            icon={Icon.Clipboard}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Propose Times"
        text={`Generate a message with your SavvyCal availability: ${dateRangeText}`}
      />

      <Form.DatePicker
        id="startDate"
        title="Start Date"
        value={startDate}
        onChange={setStartDate}
        type={Form.DatePicker.Type.Date}
      />

      <Form.DatePicker
        id="endDate"
        title="End Date"
        value={endDate}
        onChange={setEndDate}
        type={Form.DatePicker.Type.Date}
      />

      <Form.Separator />

      <Form.Dropdown
        id="timezone"
        title="Recipient's Timezone"
        value={timezone}
        onChange={setTimezone}
      >
        {TIMEZONES.map((tz) => (
          <Form.Dropdown.Item
            key={tz.value}
            value={tz.value}
            title={tz.title}
          />
        ))}
      </Form.Dropdown>

      <Form.Checkbox
        id="clickableSlots"
        label="Clickable time slots"
        value={clickableSlots}
        onChange={setClickableSlots}
        info="Each time slot becomes a link to book that specific time"
      />
    </Form>
  );
}
