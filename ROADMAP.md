# Great British 48 — Roadmap

Phase 1 is complete: working map, log/edit/delete stays, date ranges, geocoded location pins, completed-county shading, progress counter, county labels, and the "Gelly & Charlie" title. Live at great-british-48.vercel.app.

## What's next, prioritized

### Next session: Auth
Two-user accounts via Supabase Auth (Google sign-in). Attribution on every stay/place/note so we can tell who added what. Foundation for everything multi-user. Ships in one evening.

### After that: Google Maps import
One-time Google Takeout flow. Parse saved-places KML, geocode if needed, assign each to a county, store as wishlist places. Brings years of accumulated tips into the app without re-entering anything.

### Then: Places vs Stays separation + Planning view
Right now bronze pins represent stays. Add a separate `places` table for "places we want to go" with a different pin style (e.g. outlined / hollow). Add a "What's left" dashboard view: counties without stays, sorted by adjacency to completed counties, by saved places per county, etc. Shifts the app from trophy case to trip planner.

### Then: Photo integration
Pull from Google Photos and/or iCloud. Auto-match photos taken during a stay's date range and within that county's bounding box. The emotional payoff piece — benefits from auth and clean data being in place first.

### Eventually: Aesthetic pass + custom domain
Custom Mapbox basemap (softer colors, vintage atlas feel matching the Gelly & Charlie typography). Custom domain like greatbritish48.app or gellyandcharlie.uk. Once we know the app is right, make it feel finished.

## Backlog (worth building, not yet prioritized)

- **Stay detail pages** — each stay gets its own view with photos, notes, a zoomed map of where we went
- **Recommendations** — friend mentions a place → type it in, mark county, save. Inverse: what would we tell others to do in a county we've done?
- **"On this day"** — "two years ago today you stayed in Cornwall." Daily delight.
- **Future trip scheduling** — "we want to do Northumberland next April" with target month, notes, eventual itinerary
- **Export / printable** — poster-sized map of completed counties, year-end summary, coffee-table book per trip
- **Search** — "where did we stay near Bath?" "what did we do in October?" Useful around stay #15.
- **Travel time / route data** — multi-county trip planning with rough drive times
- **Sync states / loading / error handling** — spinners, optimistic UI, retry logic. Not glamorous but matters as we depend on it more.
