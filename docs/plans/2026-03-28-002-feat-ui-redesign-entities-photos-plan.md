---
title: "feat: UI warmth redesign, entity categories, Google Maps, contact photos"
type: feat
status: active
date: 2026-03-28
---

# UI Redesign + Entity Categories + Photos

## Overview

Four initiatives:
1. **UI redesign** — warm, human-connection-focused design replacing the cold corporate blue
2. **Entity categories** — manageable in settings with defaults
3. **Google Maps link parsing** — paste a link, auto-extract address/name/photo
4. **Contact photos** — pull from LinkedIn URL or device contacts

## Unit 1: Color Palette & Design Warmth

Replace the corporate blue-600 primary with a warm, human palette. The app is about RELATIONSHIPS — it should feel personal, not like Salesforce.

**New palette:**
- Primary: warm indigo (`#6366f1`) — still professional but warmer than blue
- Accent: rose/coral (`#f43f5e`) for relationship-related actions
- Success: emerald green (keep)
- Backgrounds: warm gray (`#fafaf9` stone-50) instead of cool gray-50
- Cards: white with subtle warm shadow
- Text: stone-800/900 instead of gray-800/900

**Design changes across all screens:**
- Replace `bg-gray-50` backgrounds with `bg-stone-50`
- Replace `bg-blue-600` primary with `bg-indigo-600`
- Replace `text-blue-600` with `text-indigo-600`
- Replace `border-gray-200` with `border-stone-200`
- Replace `text-gray-*` with `text-stone-*`
- Add subtle gradients on headers
- Warmer avatar colors
- Softer shadows

**Files:** constants/colors.ts, tailwind.config.js, and ALL screen/component files.

## Unit 2: Entity Categories in Settings

- New table: `entity_categories` (id, user_id, name, icon, color, is_system, created_at)
- Seed defaults: Restaurant, Company, Gym, Club, School, Church, Store, Bar, Cafe, Salon
- Settings section: "Entity Categories" with add/edit/delete
- Entity create/edit form: category picker uses these instead of free text
- Agent tools updated to know about categories

## Unit 3: Google Maps Link Parsing

When creating/editing an entity, user can paste a Google Maps link and the app extracts:
- Name
- Address
- Photo URL (from Google Places API or Open Graph meta)

Implementation: Parse the Google Maps URL, extract the place name and coordinates, use Google Places API or scrape OG meta to get details.

For MVP without a Places API key: parse the URL directly — Google Maps URLs contain the place name and address in the URL path/params.

## Unit 4: Contact Photos

Two photo sources:
- **LinkedIn URL**: If a contact has a LinkedIn URL in contact_urls, try to fetch OG image from their profile page (the profile photo is in the og:image meta tag)
- **Device contacts**: When importing from device, include the photo if available (expo-contacts already supports `Contacts.Fields.Image`)

Store photo URLs in `contacts.avatar_url`. Display in ContactCard, ContactHeader, and everywhere avatars appear. Fallback to initials circle when no photo.
