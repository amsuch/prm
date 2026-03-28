# Integrations Status

## Working Now

### Magic Link Auth (Email)
- **Status:** Working
- **How:** `supabase.auth.signInWithOtp` with `shouldCreateUser: true`
- **Config:** site_url = localhost:8081, autoconfirm = true, OTP length = 6
- Email template includes both clickable link AND 6-digit code
- `detectSessionInUrl: true` on web handles redirect tokens

### OpenAI / Anthropic LLM
- **Status:** Working
- **How:** Direct fetch() to API endpoints from client
- **Config:** API key stored in user metadata (`ai_api_key`), selected via Settings
- Supports: gpt-5.4, gpt-5.4-mini, gpt-5.4-nano, gpt-4.1, gpt-4.1-mini
- Supports: claude-opus-4-6, claude-sonnet-4-6, claude-opus-4-5, etc.
- Tool calling: 16 tools with HITL approval for mutations

### LinkedIn CSV Import
- **Status:** Working
- **How:** File picker → papaparse → batch Supabase insert
- Imports: name, company, title, email, LinkedIn URL

### Device Contacts Import
- **Status:** Working (mobile only)
- **How:** expo-contacts with permission flow
- Includes photos from device contacts

## Needs Google Cloud Setup

### Google Sign-In
- **Status:** Disabled — no Google Cloud OAuth credentials configured
- **What's needed:**
  1. Go to [console.cloud.google.com](https://console.cloud.google.com)
  2. Create a project (or use existing)
  3. APIs & Services → Credentials → Create OAuth Client ID
  4. Application type: Web application
  5. Authorized redirect URI: `https://rymspebhcinjttcrmtow.supabase.co/auth/v1/callback`
  6. Copy Client ID + Client Secret
  7. Add to `.env.local`:
     ```
     GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=your-client-secret
     ```
  8. I'll configure Supabase automatically via Management API

### Google Calendar Sync
- **Status:** Code complete, needs same Google Cloud credentials + Calendar API scope
- **What's needed (in addition to Google Sign-In setup):**
  1. In Google Cloud Console → APIs & Services → Library
  2. Enable "Google Calendar API"
  3. In OAuth consent screen → Scopes → Add `https://www.googleapis.com/auth/calendar.events.readonly`
  4. The app code already handles the OAuth flow with Calendar scope
  5. Calendar sync will work once Google Sign-In is enabled

### Google Maps (Entity Address Parsing)
- **Status:** URL parsing works, Places API enrichment not implemented
- **What works now:** Paste a Google Maps URL → extracts place name + address from the URL itself
- **Future:** Google Places API for richer data (photos, hours, reviews) — needs Places API key

## Integration Enablement Script

Once you have Google credentials, add them to `.env.local` and run:
```bash
# I'll automatically configure everything via the Supabase Management API
source .env.local
curl -X PATCH "https://api.supabase.com/v1/projects/rymspebhcinjttcrmtow/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCOUNT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"external_google_enabled\": true,
    \"external_google_client_id\": \"${GOOGLE_CLIENT_ID}\",
    \"external_google_secret\": \"${GOOGLE_CLIENT_SECRET}\"
  }"
```
