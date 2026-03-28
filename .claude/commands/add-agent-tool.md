# Add Agent Tool

Add a new tool that the AI agent can use in the Ask tab.

## Arguments
$ARGUMENTS — description of the tool (what it does, what params it needs)

## Steps

### 1. Add tool definition to lib/tools.ts

Add to the `getToolDefinitions()` array:

```typescript
{
  name: "tool_name",
  description: "3-4 sentences explaining what this tool does, when to use it, what it returns. Be specific — the LLM uses this to decide when to call it.",
  parameters: {
    type: "object",
    properties: {
      param1: { type: "string", description: "What this param is for" },
      param2: { type: "number", description: "Optional param" },
    },
    required: ["param1"],
    // Do NOT use additionalProperties: false with optional params
    // Do NOT use strict: true
  },
  requiresApproval: false, // true for mutations (create, update, delete)
  async execute(input, userId) {
    // Call Supabase, return data
    // Use findContactsByName() from lib/contactLookup.ts for name lookups
    // Return only relevant fields (not full DB rows)
    // Cap arrays at 20 items with total_count
  },
},
```

### 2. Test the tool schema

Run `/test-api` with the new tool included to verify the schema is accepted.

### 3. Add to ChatBubble rendering (if needed)

If the tool returns a new result type, add rendering in the appropriate `components/chat/` sub-component.

### 4. Add suggested question

Add an example question to `components/SuggestedQuestions.tsx` that demonstrates the tool.

### 5. Verify build

```bash
pnpm exec expo export --platform web
```

## Common mistakes to avoid
- Don't use `strict: true` — breaks optional params
- Don't use `additionalProperties: false` — same issue
- Don't return full DB rows — only fields the LLM needs
- Don't forget `requiresApproval: true` for mutations
- Test with actual API call, not just build
