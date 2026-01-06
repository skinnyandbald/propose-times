/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** SavvyCal API Token - Your SavvyCal Personal Access Token (starts with pt_secret_) */
  "savvycalToken": string,
  /** SavvyCal Link Slug - The slug from your SavvyCal URL (e.g., 'chat' from savvycal.com/skinnyandbald/chat) */
  "savvycalLink": string,
  /** SavvyCal Username - Your SavvyCal username (e.g., 'skinnyandbald') */
  "savvycalUsername": string,
  /** Default Recipient Timezone - Default timezone for the person you're proposing times to */
  "defaultTimezone": "America/New_York" | "America/Chicago" | "America/Denver" | "America/Los_Angeles" | "UTC" | "Europe/London" | "Europe/Paris" | "Asia/Tokyo" | "Australia/Sydney",
  /** Default Days Ahead - Default number of days to look ahead for availability */
  "defaultDaysAhead": string,
  /** Booker URL - URL of your savvycal-booker Vercel deployment (enables one-click booking). Leave empty to link directly to SavvyCal. */
  "bookerUrl"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `propose-times` command */
  export type ProposeTimes = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `propose-times` command */
  export type ProposeTimes = {}
}

