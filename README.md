# Propose Times

A Raycast extension that generates meeting time proposals from your SavvyCal availability.

Instead of sending a scheduling link and hoping someone picks a time, propose specific windows that work for you—formatted for the recipient's timezone with optional one-click booking.

## Features

- Fetches your real-time SavvyCal availability
- Groups consecutive slots into readable time windows
- Converts times to recipient's timezone
- Generates copy-paste ready messages
- Optional one-click booking links (with [savvycal-booker](https://github.com/skinnyandbald/savvycal-booker))

## Example Output

```
Would any of these time windows work for a 25 min meeting (ET)?
• Mon, Jan 6: 9:00am - 12:00pm, 2:00pm - 5:00pm
• Tue, Jan 7: 10:00am - 11:30am, 3:00pm - 5:00pm
• Wed, Jan 8: 9:00am - 12:00pm

Feel free to use this booking page if that's easier:
https://savvycal.com/skinnyandbald/chat
```

## Installation

### Prerequisites

- [Raycast](https://raycast.com) installed
- A [SavvyCal](https://savvycal.com) account with an API token

### From Source

```bash
# Clone the repository
git clone https://github.com/skinnyandbald/propose-times.git
cd propose-times

# Install dependencies
npm install

# Start development mode (extension appears in Raycast)
npm run dev
```

### On Additional Computers

Same steps as above—clone, install, run dev. Your preferences (API token, etc.) are stored locally by Raycast on each machine.

## Configuration

Open Raycast, search for "Propose Times", and configure these preferences:

| Setting | Required | Description |
|---------|----------|-------------|
| **SavvyCal API Token** | Yes | Your Personal Access Token from [SavvyCal Settings](https://savvycal.com/settings/integrations) (starts with `pt_secret_`) |
| **SavvyCal Link Slug** | Yes | The slug from your scheduling URL (e.g., `chat` from `savvycal.com/username/chat`) |
| **SavvyCal Username** | Yes | Your SavvyCal username |
| **Default Recipient Timezone** | Yes | Default timezone for time display |
| **Default Days Ahead** | No | How many days to look ahead (default: 10) |
| **Booker URL** | No | Your savvycal-booker deployment URL for one-click booking |

## One-Click Booking (Optional)

By default, time slots link to your SavvyCal page. For true one-click booking, deploy [savvycal-booker](https://github.com/skinnyandbald/savvycal-booker):

1. Deploy savvycal-booker to Vercel
2. Add your Vercel URL to the **Booker URL** preference
3. Time slots now link directly to a booking form—no calendar picker needed

## Usage

1. Open Raycast (`⌘ + Space`)
2. Search "Propose Times"
3. Adjust date range, duration, and timezone as needed
4. Press Enter to generate and copy the message
5. Paste into email, Slack, etc.

## Development

```bash
npm run dev      # Start development mode
npm run build    # Build for production
npm run lint     # Run linter
npm run fix-lint # Auto-fix lint issues
```

## License

MIT
