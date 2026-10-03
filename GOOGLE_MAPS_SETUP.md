# Google Maps venue picker setup

The Create Event and Edit Event forms load Google Maps JavaScript from the browser using `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. The key is public by design; protect it with API and HTTP referrer restrictions. The picker remains usable with manual venue and address entry when this variable is unset.

## Google Cloud configuration

1. Select or create the Google Cloud project used for EventOps and enable billing.
2. Enable **Maps JavaScript API** and **Places API (New)** for that project.
3. Create an API key. Under API restrictions, allow only Maps JavaScript API and Places API (New).
4. Under website/referrer restrictions, allow only the app origins you operate, including `http://localhost:3000/*` for local development and the exact HTTPS production domains (for example, `https://events.example.com/*`). Add each staging domain explicitly. Do not use unrestricted referrers or publish the key in source control.
5. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local` and in the deployment platform's environment configuration, then restart/redeploy the app.

The key is used in the client to load Maps JavaScript and the Places Autocomplete element. Usage and billing are subject to the quotas and pricing configured for the Google Cloud project. The picker biases its prompt to the selected city; admins should select a result in that city. The server enforces that the saved venue record belongs to the event's selected city.
