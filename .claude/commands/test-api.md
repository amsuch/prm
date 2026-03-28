# Test API Integration

Before committing any code that calls an external API, run this validation.

## Steps

1. Read the source file that makes the API call. Identify:
   - The exact URL endpoint
   - The HTTP method
   - The headers (especially Authorization format)
   - The request body (especially parameter names like `max_tokens` vs `max_completion_tokens`)
   - The expected response shape

2. Source the environment: `source /workspaces/prm-sc/.env.local`

3. Get the user's actual API key from Supabase user metadata:
```bash
source .env.local && curl -s "https://rymspebhcinjttcrmtow.supabase.co/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY_LEGACY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY_LEGACY}" | \
  node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); j.users.forEach(u => console.log(u.email, ':', JSON.stringify(u.user_metadata).slice(0,100)))"
```

4. Reproduce the EXACT API call the app would make using curl. Include:
   - The actual model ID
   - The actual tool definitions (if tool calling)
   - The actual parameter names
   - A simple test message

5. Verify the response:
   - Success case: does the response format match what the code parses?
   - Error case: test with a wrong model ID, expired key, etc.
   - If tool calling: does the model return `tool_calls` / `tool_use` correctly?

6. If listing models in UI, query the actual API:
```bash
curl -s "https://api.openai.com/v1/models" -H "Authorization: Bearer $KEY" | \
  node -e "..." # filter for relevant models
```

7. Test each model in the list with a real API call to confirm it works with the endpoint (e.g., not all models support /v1/chat/completions).

## Failures this prevents
- `max_tokens` vs `max_completion_tokens` (OpenAI newer models)
- `gpt-5.4-pro` not being a chat model
- `strict: true` breaking optional tool parameters
- Guessed model IDs that don't exist
