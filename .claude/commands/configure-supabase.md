# Configure Supabase

Modify Supabase project settings via the Management API. No dashboard needed.

## Arguments
$ARGUMENTS — what to configure (auth, redirect URLs, providers, etc.)

## Available APIs

### Read current config
```bash
source .env.local && \
curl -s "https://api.supabase.com/v1/projects/rymspebhcinjttcrmtow/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCOUNT_TOKEN}" | node -e "
const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
Object.entries(j).filter(([k,v])=> v !== null && v !== '' && v !== false).forEach(([k,v]) => console.log(k+':', typeof v==='string'? v.slice(0,80): v));
"
```

### Update config
```bash
source .env.local && \
curl -s -X PATCH "https://api.supabase.com/v1/projects/rymspebhcinjttcrmtow/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCOUNT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "setting_name": "new_value"
  }'
```

### Common settings
- `site_url` — the app's base URL
- `uri_allow_list` — comma-separated allowed redirect URLs
- `external_google_enabled` — enable Google OAuth
- `external_google_client_id` — Google Client ID
- `external_google_secret` — Google Client Secret
- `mailer_autoconfirm` — skip email verification
- `mailer_otp_length` — OTP code digit count
- `mailer_templates_magic_link_content` — HTML email template

### Direct SQL via session pooler
```bash
node -e "
const { Client } = require('pg');
const c = new Client({
  host: 'aws-0-us-west-2.pooler.supabase.com', port: 5432,
  user: 'postgres.rymspebhcinjttcrmtow', password: '!i3fHR5NmrocwzZd',
  database: 'postgres', ssl: { rejectUnauthorized: false }
});
async function run() {
  await c.connect();
  // Your SQL here
  await c.end();
}
run();
"
```

### Admin user operations
```bash
source .env.local && \
curl -s "https://rymspebhcinjttcrmtow.supabase.co/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY_LEGACY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY_LEGACY}"
```
