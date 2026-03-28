---
title: "refactor: Architecture unification + development skills"
type: refactor
status: active
date: 2026-03-28
---

# Architecture Unification

## Analysis Summary

92 files, 23k lines built ad-hoc across 24 commits. Key issues:
- **6x duplicated avatar logic** across components
- **5x duplicated contact lookup** in agent.ts
- **agent.ts (2,040 lines) overlaps with tools.ts (1,393 lines)** — same operations in two places
- **18 hooks with inconsistent return shapes** — some use `refresh`, others `refetch`
- **ChatBubble.tsx (1,006 lines)** — 6 sub-components crammed into one file
- **175 type casts** (`as unknown as T`) scattered everywhere

## Implementation Units

- [ ] **Unit 1: Shared Avatar Component**

Extract `getAvatarColor()` and initials rendering into a reusable `Avatar` component. Delete 6 duplicate implementations.

Files:
- Create: `components/Avatar.tsx`
- Modify: ContactCard, ContactHeader, ChatBubble, RelationshipsList, AddRelationshipModal, EntityCard, EntityPersonCard, RecentActivity, bulk-link.tsx, calendar-suggestions.tsx

- [ ] **Unit 2: Contact Lookup Module**

Extract repeated `supabase.from("contacts")...ilike` pattern into a shared function.

Files:
- Create: `lib/contactLookup.ts`
- Modify: agent.ts, relationships.ts, tools.ts

- [ ] **Unit 3: Consolidate agent.ts ↔ tools.ts**

agent.ts has 22 handler functions that duplicate logic in tools.ts. Make agent.ts a thin dispatcher that calls tool execute functions instead.

Files:
- Modify: `lib/agent.ts` — delete duplicate handlers, call tools.ts functions
- Modify: `lib/tools.ts` — export execute functions for direct use

- [ ] **Unit 4: Split ChatBubble.tsx**

Extract sub-components into their own files.

Files:
- Create: `components/chat/ContactResults.tsx`
- Create: `components/chat/InteractionResult.tsx`
- Create: `components/chat/StatsDisplay.tsx`
- Create: `components/chat/ToolProgress.tsx`
- Create: `components/chat/ApprovalCard.tsx`
- Create: `components/chat/SQLResult.tsx`
- Simplify: `components/ChatBubble.tsx` → imports from chat/

- [ ] **Unit 5: Hook Return Consistency**

Standardize all 18 hooks to use consistent return shapes: `{ data, isLoading, error, refetch }`.

- [ ] **Unit 6: Development Skills for CLAUDE.md**

Add practical skills/checklists that address the specific failures from this session:
- Pre-commit API testing checklist
- Swarm agent design token injection
- Hook authoring conventions
- Component extraction criteria
