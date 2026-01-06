# Propose Times

A Raycast extension that pulls your SavvyCal availability and generates a message with specific times—in the recipient's timezone, with one-click booking.

## Why I Built This

I've been frustrated by scheduling for years. Tried a bunch of approaches: autonomous agents, back-and-forth over email, just sending my SavvyCal link.

The problem with scheduling links is they put all the work on the other person. They have to open your calendar, scan through days, pick a time, fill out a form. It feels lazy on your end.

Proposing specific times is more respectful. The recipient can click one time and book instantly. If none work, they still have your full calendar as a fallback. And every time is shown in *their* timezone—no mental math required.

## How It Works

1. Open Raycast → "Propose Times"
2. Pick date range, duration, recipient's timezone
3. Hit Enter → message copied to clipboard
4. Paste into email or Slack

## What It Generates

```
Would any of these times work for a 25 min meeting (ET)?
• Mon, Jan 6: 9:00am, 10:30am, 2:00pm, 4:00pm
• Tue, Jan 7: 9:30am, 11:00am, 3:00pm
• Wed, Jan 8: 10:00am, 1:00pm, 3:30pm

Feel free to use this booking page if that's easier (also contains more availabilities):
https://savvycal.com/you/chat
```

Each time is a link. Click → booking form → done.

## Setup

You'll need [Raycast](https://raycast.com) and a [SavvyCal](https://savvycal.com) API token.

```bash
git clone https://github.com/skinnyandbald/propose-times.git
cd propose-times
npm install
npm run build
```

Then in Raycast: **Preferences → Extensions → + → Import Extension** → select the folder.

That's it. No terminal running in the background—it's installed like any other Raycast extension.

### Development

If you want to make changes:

```bash
npm run dev  # Hot-reloads, but terminal must stay open
```

### Configuration

| Setting | What it is |
|---------|------------|
| **SavvyCal API Token** | Get it from [SavvyCal Settings](https://savvycal.com/settings/integrations) |
| **Link Slug** | The `chat` part of `savvycal.com/you/chat` |
| **Username** | Your SavvyCal username |
| **Default Timezone** | Recipient's timezone |

## One-Click Booking

By default, time slots link to your SavvyCal page. For true one-click booking (click → enter name/email → booked), deploy the companion app:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fskinnyandbald%2Fsavvycal-booker&env=SAVVYCAL_TOKEN&envDescription=Your%20SavvyCal%20Personal%20Access%20Token&envLink=https%3A%2F%2Fsavvycal.com%2Fsettings%2Fintegrations)

Then add your Vercel URL to the **Booker URL** preference.

## License

MIT
