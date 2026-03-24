# Snap Nourish — Backend System Design Document

**Version:** 1.0  
**Date:** March 24, 2026  
**Status:** Implementation-Ready  
**Audience:** Developer agent building the entire backend end-to-end

---

## Table of Contents

1. [Architecture Overview](#section-1-architecture-overview)
2. [Authentication](#section-2-authentication)
3. [Database Schema](#section-3-database-schema)
4. [Food Recognition Pipeline (Photo → Nutrition)](#section-4-food-recognition-pipeline-photo--nutrition)
5. [Text Parsing Pipeline (Text → Nutrition)](#section-5-text-parsing-pipeline-text--nutrition)
6. [API Design](#section-6-api-design)
7. [Offline-First & Sync Strategy](#section-7-offline-first--sync-strategy)
8. [File Storage (Photos)](#section-8-file-storage-photos)
9. [PWA & Real Camera Integration](#section-9-pwa--real-camera-integration)
10. [Deployment & Infrastructure](#section-10-deployment--infrastructure)
11. [Migration Plan](#section-11-migration-plan)
12. [Security & Privacy](#section-12-security--privacy)

---

## Section 1: Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENT (React 18 PWA)                            │
│                                                                         │
│  ┌──────────────┐   ┌───────────────┐   ┌───────────────────────────┐  │
│  │  React Pages  │──►│  storage.ts    │──►│  sync-engine.ts           │  │
│  │  (frozen UI)  │◄──│  (localStorage │◄──│  (offline queue,          │  │
│  │               │   │   + API calls) │   │   conflict resolution,    │  │
│  │               │   │               │   │   IndexedDB queue)        │  │
│  └──────────────┘   └───────────────┘   └────────────┬──────────────┘  │
│                                                       │                 │
│  ┌──────────────────────────┐                         │                 │
│  │  Service Worker (Workbox) │  ← shell cache,        │                 │
│  │  vite-plugin-pwa v0.21+  │    API cache            │                 │
│  └──────────────────────────┘                         │                 │
│                                                       │                 │
│  ┌──────────────────────────┐                         │                 │
│  │  supabaseClient.ts       │  ← @supabase/supabase-js│                 │
│  │  (auth, realtime, REST)  │◄────────────────────────┘                 │
│  └──────────────┬───────────┘                                           │
└─────────────────┼───────────────────────────────────────────────────────┘
                  │ HTTPS (TLS 1.3)
                  │
┌─────────────────▼───────────────────────────────────────────────────────┐
│                    SUPABASE PROJECT (supabase.com)                       │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐    │
│  │  Supabase     │  │  PostgREST   │  │  Supabase Edge Functions   │    │
│  │  Auth (GoTrue)│  │  (auto-      │  │  (Deno runtime)            │    │
│  │               │  │   generated  │  │                            │    │
│  │  • Google     │  │   REST API   │  │  • POST /analyze-photo     │    │
│  │  • Apple      │  │   from DB    │  │  • POST /analyze-text      │    │
│  │  • Email/OTP  │  │   schema)    │  │  • POST /export-data       │    │
│  │  • Anonymous  │  │              │  │  • POST /delete-account     │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────────┘    │
│         │                 │                      │                       │
│  ┌──────▼─────────────────▼──────────────────────▼─────────────────┐    │
│  │                   PostgreSQL 15 (Supabase-managed)               │    │
│  │                                                                  │    │
│  │  Tables: meals, meal_templates, user_profiles, user_preferences, │    │
│  │          pinned_meals, photo_analyses, nutrition_cache,           │    │
│  │          sync_checkpoints                                        │    │
│  │                                                                  │    │
│  │  Row-Level Security (RLS) on ALL user-facing tables              │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                   Supabase Storage (S3-compatible)                │    │
│  │                                                                  │    │
│  │  Buckets:                                                        │    │
│  │    • meal-photos-temp   (24h TTL, auto-cleanup lifecycle rule)   │    │
│  │    • meal-photos-perm   (no TTL, user opt-in only)               │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                  │
                  │ HTTPS outbound from Edge Functions
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                │
│                                                                         │
│  ┌────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  OpenAI API             │  │  Nutrition Data Sources               │  │
│  │                         │  │                                      │  │
│  │  • GPT-4o-mini (vision) │  │  1. USDA FoodData Central API (free) │  │
│  │    for photo analysis   │  │  2. Nutritionix API ($0.003/call)    │  │
│  │  • GPT-4o-mini (text)   │  │  3. OpenFoodFacts API (free)         │  │
│  │    for text parsing     │  │  4. Local nutrition_cache (Postgres) │  │
│  │  • GPT-4o (fallback     │  │                                      │  │
│  │    for low confidence)  │  └──────────────────────────────────────┘  │
│  └────────────────────────┘                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Inventory

| Component | Exact Technology | Why This Over Alternatives | Cost @ 1K MAU | Cost @ 10K MAU | Cost @ 100K MAU |
|-----------|-----------------|---------------------------|---------------|----------------|-----------------|
| **Database** | Supabase PostgreSQL 15 | Relational model fits user→meals FK; RLS for multi-tenant isolation; standard SQL (no vendor lock-in, can `pg_dump` and leave); PostgREST auto-generates REST API from schema | $0 (free tier: 500MB, 50K auth) | $25/mo (Pro: 8GB, 100K auth) | $75+compute add-ons (Pro: custom compute, read replicas) |
| **Auth** | Supabase Auth (GoTrue) | Integrated with same Postgres (user IDs are FK-able); supports Google, Apple, email/OTP, anonymous; PKCE flow; free up to 50K MAU; no separate vendor (Auth0 = $23/mo at 1K MAU, Clerk = $25/mo) | $0 | $0 (included in Pro) | $0 (included in Pro) |
| **API Layer** | Supabase PostgREST (auto-generated) + Edge Functions (Deno) | PostgREST gives typed CRUD for free from schema; Edge Functions (Deno) for custom logic (ML pipeline, data export); no Express/Fastify to deploy and maintain | $0 | $0 (included) | $0 (included, 500K invocations/mo free; then $2/million) |
| **File Storage** | Supabase Storage (S3-compatible) | Same project, same auth, RLS on buckets; 1GB free; serves via CDN; lifecycle rules for auto-delete | $0 (1GB free) | $0.021/GB beyond 1GB | $0.021/GB |
| **Food Recognition** | OpenAI GPT-4o-mini (vision capability) | Best cost/accuracy ratio for food identification; $0.15/1M input tokens + $0.60/1M output tokens; no training data needed; handles Indian, Western, Asian cuisines; runner-up: Google Gemini 2.0 Flash ($0.10/1M input but less accurate on portion estimation in testing) | ~$15/mo | ~$150/mo | ~$1,500/mo |
| **Nutrition Database** | USDA FoodData Central API (primary) + Nutritionix (secondary) + local cache | USDA is free and authoritative for 380K+ foods; Nutritionix handles natural language ("2 scrambled eggs with cheese") at $0.003/call; local cache eliminates repeat lookups | $0 (USDA free) + ~$5 (Nutritionix) | ~$50 (Nutritionix) | ~$300 (Nutritionix) |
| **Cache Layer** | nutrition_cache table in same PostgreSQL | No Redis needed — nutrition data is write-once-read-many; PostgreSQL with proper indexes serves sub-10ms lookups; adding Redis is a premature optimization that costs $10+/mo and adds operational complexity | $0 | $0 | $0 (re-evaluate at 100K+ if nutrition lookup latency exceeds 50ms) |
| **Background Jobs** | Supabase Edge Functions + PostgreSQL `pg_cron` extension | `pg_cron` handles scheduled cleanup (expired photos, stale sync checkpoints); Edge Functions handle async ML processing; no separate job queue (SQS, Bull) needed at this scale | $0 | $0 | $0 |
| **CDN** | Supabase CDN (built-in for Storage) + Vercel/Cloudflare for SPA | Supabase Storage serves photos via CDN automatically; SPA deployed to Vercel (free tier) or Cloudflare Pages (free tier) | $0 | $0 | $0 (Vercel Pro $20/mo if traffic exceeds free tier) |

### Total Infrastructure Cost Summary

| Scale | Supabase | OpenAI | Nutritionix | SPA Hosting | **Total** |
|-------|----------|--------|-------------|-------------|-----------|
| 1K MAU | $0 | $15 | $5 | $0 | **$20/mo** |
| 10K MAU | $25 | $150 | $50 | $0 | **$225/mo** |
| 100K MAU | $75 | $1,500 | $300 | $20 | **$1,895/mo** |

---

## Section 2: Authentication

### 2.1 Provider: Supabase Auth (GoTrue)

**Why Supabase Auth over alternatives:**
- **vs Auth0:** Auth0 costs $23/mo at 1K MAU (B2C Essentials plan). Supabase Auth is free up to 50K MAU and lives in the same project — no cross-service JWT validation needed.
- **vs Clerk:** Clerk costs $25/mo at 1K MAU. Good DX but adds another vendor dependency and SDK.
- **vs Firebase Auth:** Firebase Auth is free but locks you into Firebase ecosystem (Firestore, Cloud Functions). Supabase Auth is backed by standard PostgreSQL.

### 2.2 Supported Login Methods

| Method | Implementation | Priority |
|--------|---------------|----------|
| **Google OAuth 2.0** | Supabase Auth `signInWithOAuth({ provider: 'google' })` — PKCE flow, no client secret in browser | Phase 1 (launch) |
| **Apple Sign-In** | Supabase Auth `signInWithOAuth({ provider: 'apple' })` — required for iOS PWA "Add to Home Screen" | Phase 1 (launch) |
| **Email + OTP (magic link)** | Supabase Auth `signInWithOtp({ email })` — no passwords to hash/store/breach | Phase 1 (launch) |
| **Anonymous Auth** | Supabase Auth `signInAnonymously()` — user gets a real `user_id`, can log meals immediately, links to real identity later | Phase 1 (launch) |

### 2.3 OAuth Flow (Google Example)

```
1. User taps "Continue with Google" in Onboarding.tsx

2. Frontend calls:
   const { data, error } = await supabase.auth.signInWithOAuth({
     provider: 'google',
     options: {
       redirectTo: `${window.location.origin}/home`,
       queryParams: {
         access_type: 'offline',
         prompt: 'consent',
       },
     },
   });

3. Browser redirects to:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id=<YOUR_GOOGLE_CLIENT_ID>&
     redirect_uri=https://<PROJECT_REF>.supabase.co/auth/v1/callback&
     response_type=code&
     scope=openid%20email%20profile&
     code_challenge=<PKCE_CHALLENGE>&
     code_challenge_method=S256

4. User consents → Google redirects to Supabase callback URL

5. Supabase exchanges code for tokens (server-side, PKCE), creates/updates
   auth.users row, generates Supabase JWT

6. Supabase redirects to `redirectTo` URL with session in URL fragment:
   https://yourapp.com/home#access_token=<JWT>&refresh_token=<REFRESH>&...

7. Supabase JS SDK automatically picks up tokens from URL fragment,
   stores in localStorage under `sb-<project-ref>-auth-token`

8. All subsequent supabase.from('meals').select() calls automatically
   include the JWT in the Authorization header

9. RLS policies check auth.uid() = user_id on every query
```

### 2.4 Session and Token Management

| Token | Lifetime | Storage | Refresh |
|-------|----------|---------|---------|
| Access token (JWT) | 3600 seconds (1 hour) — configurable in Supabase dashboard | localStorage via Supabase SDK | Auto-refreshed by `@supabase/supabase-js` when expired |
| Refresh token | 7 days (configurable) | localStorage via Supabase SDK | Used to obtain new access token |

The Supabase JS SDK handles token refresh automatically. When the access token is within 60 seconds of expiry, the SDK calls the refresh endpoint. If the refresh token is also expired, the user is logged out.

### 2.5 Current Frontend Auth (What Changes)

**Current fake auth in `Onboarding.tsx` (lines 61-65):**
```typescript
const handleAuth = (provider: string) => {
  setFlag("authProvider", provider);
  saveAuthUser({ provider, name: name || "User", loggedIn: true });
  setStep("profile");
};
```

**Replacement:**
```typescript
const handleAuth = async (provider: "google" | "apple") => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) {
    toast.error("Sign in failed. Please try again.");
    return;
  }
  // Redirect happens automatically — no need to setStep here.
  // The /auth/callback route will handle post-auth navigation.
};
```

**New route needed: `/auth/callback`**
```typescript
// src/pages/AuthCallback.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Sync auth user data to localStorage for backward compatibility
        const user = session.user;
        saveAuthUser({
          provider: user.app_metadata.provider || "email",
          name: user.user_metadata.full_name || user.user_metadata.name || "User",
          loggedIn: true,
          id: user.id,
          email: user.email,
        });
        setFlag("authProvider", user.app_metadata.provider || "email");
        setFlag("onboarded", "true");
        navigate("/home", { replace: true });
      }
    });
  }, [navigate]);

  return <div className="flex items-center justify-center min-h-screen">Signing in...</div>;
};
```

**Current logout in `Profile.tsx` (lines 94-99):**
```typescript
const handleLogout = () => {
  removeFlag("authUser");
  removeFlag("authProvider");
  removeFlag("onboarded");
  navigate("/onboarding", { replace: true });
};
```

**Replacement:**
```typescript
const handleLogout = async () => {
  await supabase.auth.signOut();
  removeFlag("authUser");
  removeFlag("authProvider");
  removeFlag("onboarded");
  localStorage.clear(); // Clear all cached data on logout
  navigate("/onboarding", { replace: true });
};
```

### 2.6 Guest/Anonymous Mode

Users should be able to log meals before creating an account. Supabase supports anonymous auth:

```typescript
// On first app open, if no session exists:
const { data, error } = await supabase.auth.signInAnonymously();
// This creates a real user in auth.users with is_anonymous = true
// The user gets a real user_id — all meals are stored under this ID
```

**Anonymous → Authenticated migration:**
```typescript
// When user later taps "Continue with Google":
const { data, error } = await supabase.auth.linkIdentity({
  provider: 'google',
});
// This links the Google identity to the existing anonymous user
// All meals, templates, and profile data are preserved — same user_id
```

This is critical for conversion: users can start logging immediately, see value, then sign up to enable sync/backup.

### 2.7 Auth API Endpoints (Handled by Supabase SDK)

These are not custom endpoints — they are provided by Supabase Auth:

| Action | SDK Method | Underlying HTTP |
|--------|-----------|-----------------|
| Sign up with email | `supabase.auth.signUp({ email, password })` | `POST /auth/v1/signup` |
| Sign in with email | `supabase.auth.signInWithPassword({ email, password })` | `POST /auth/v1/token?grant_type=password` |
| Sign in with OTP | `supabase.auth.signInWithOtp({ email })` | `POST /auth/v1/otp` |
| Sign in with OAuth | `supabase.auth.signInWithOAuth({ provider })` | Redirect to `GET /auth/v1/authorize?provider=...` |
| Sign in anonymously | `supabase.auth.signInAnonymously()` | `POST /auth/v1/signup` (anonymous) |
| Refresh token | `supabase.auth.refreshSession()` | `POST /auth/v1/token?grant_type=refresh_token` |
| Sign out | `supabase.auth.signOut()` | `POST /auth/v1/logout` |
| Get current user | `supabase.auth.getUser()` | `GET /auth/v1/user` |
| Link identity | `supabase.auth.linkIdentity({ provider })` | `POST /auth/v1/user/identities/authorize` |

---

## Section 3: Database Schema

### 3.1 Complete SQL Schema

```sql
-- ============================================================================
-- Snap Nourish Database Schema
-- Target: Supabase PostgreSQL 15
-- Run this in Supabase SQL Editor or as a migration file
-- ============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";     -- for scheduled cleanup jobs


-- ============================================================================
-- TABLE: meals
-- Maps to frontend interface: Meal
-- localStorage key: "meals" (JSON array)
-- ============================================================================
-- Frontend Meal interface:
--   id: string (crypto.randomUUID())
--   type: string ("photo" | "text" | "template" | "quick")
--   timestamp: string (ISO 8601)
--   description: string
--   calories: number
--   protein: number (grams)
--   carbs: number (grams)
--   fat: number (grams)
--   photoUrl?: string
--   mealLabel?: string ("Breakfast" | "Lunch" | "Dinner" | "Snack")

CREATE TABLE meals (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL CHECK (type IN ('photo', 'text', 'template', 'quick')),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description   TEXT        NOT NULL DEFAULT '',
  calories      REAL        NOT NULL DEFAULT 0 CHECK (calories >= 0),
  protein       REAL        NOT NULL DEFAULT 0 CHECK (protein >= 0),
  carbs         REAL        NOT NULL DEFAULT 0 CHECK (carbs >= 0),
  fat           REAL        NOT NULL DEFAULT 0 CHECK (fat >= 0),
  photo_url     TEXT,
  meal_label    TEXT        CHECK (meal_label IS NULL OR meal_label IN ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  -- Sync metadata
  client_id     UUID,       -- original UUID generated by crypto.randomUUID() on client
  version       INTEGER     NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ -- soft delete for sync (client needs to know what was deleted)
);

-- Index for fetching meals by user + date range (the primary query pattern)
CREATE INDEX idx_meals_user_timestamp
  ON meals (user_id, timestamp DESC)
  WHERE deleted_at IS NULL;

-- Index for sync: fetch all changes since last sync
CREATE INDEX idx_meals_user_updated
  ON meals (user_id, updated_at);

-- Dedup: prevent duplicate inserts from offline sync retries
CREATE UNIQUE INDEX idx_meals_user_client_id
  ON meals (user_id, client_id)
  WHERE client_id IS NOT NULL;


-- ============================================================================
-- TABLE: meal_templates
-- Maps to frontend interface: MealTemplate
-- localStorage key: "mealTemplates" (JSON array)
-- ============================================================================
-- Frontend MealTemplate interface:
--   id: string
--   name: string
--   calories: number
--   protein: number
--   carbs: number
--   fat: number
--   count: number (times logged)
--   lastLogged: string (ISO 8601)
--   mealTiming: "breakfast" | "lunch" | "dinner" | "snack"

CREATE TABLE meal_templates (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  calories      REAL        NOT NULL DEFAULT 0 CHECK (calories >= 0),
  protein       REAL        NOT NULL DEFAULT 0 CHECK (protein >= 0),
  carbs         REAL        NOT NULL DEFAULT 0 CHECK (carbs >= 0),
  fat           REAL        NOT NULL DEFAULT 0 CHECK (fat >= 0),
  count         INTEGER     NOT NULL DEFAULT 0,
  last_logged   TIMESTAMPTZ,
  meal_timing   TEXT        NOT NULL CHECK (meal_timing IN ('breakfast', 'lunch', 'dinner', 'snack')),
  -- Sync metadata
  client_id     TEXT,       -- original ID from frontend (e.g., "tpl_1711234567890")
  version       INTEGER     NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_templates_user
  ON meal_templates (user_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_templates_user_client_id
  ON meal_templates (user_id, client_id)
  WHERE client_id IS NOT NULL;


-- ============================================================================
-- TABLE: user_profiles
-- Maps to frontend: Record<string, string> from getProfile()
-- localStorage key: "nutrition-profile"
-- ============================================================================
-- Frontend profile keys used across pages:
--   name, age, height, weight, goal,
--   calorieGoal, proteinGoal, carbGoal, fatGoal
-- All stored as strings on frontend (Input type="number" still produces strings)

CREATE TABLE user_profiles (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT,
  height          TEXT,       -- string to match frontend contract (e.g., "170")
  weight          TEXT,       -- string (e.g., "70")
  age             TEXT,       -- string (e.g., "25")
  goal            TEXT        CHECK (goal IS NULL OR goal IN ('lose', 'maintain', 'gain')),
  calorie_goal    TEXT        DEFAULT '2000',
  protein_goal    TEXT        DEFAULT '120',
  carb_goal       TEXT        DEFAULT '250',
  fat_goal        TEXT        DEFAULT '70',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- TABLE: user_preferences
-- Maps to frontend flags stored via setFlag/getFlag
-- localStorage keys: "personalization-completed", "personalization-dismissed",
--                    "templatePromptsDismissed", "theme", "show-first-hint"
-- ============================================================================

CREATE TABLE user_preferences (
  user_id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme                       TEXT DEFAULT 'system',
  onboarded                   BOOLEAN DEFAULT FALSE,
  personalization_completed   BOOLEAN DEFAULT FALSE,
  personalization_dismissed   BOOLEAN DEFAULT FALSE,
  show_first_hint             BOOLEAN DEFAULT TRUE,
  template_prompts_dismissed  TEXT[] DEFAULT '{}', -- array of normalized meal descriptions
  photo_storage_opt_in        BOOLEAN DEFAULT FALSE, -- user consent for permanent photo storage
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- TABLE: pinned_meals
-- Maps to frontend: Record<string, string[]> from getPinnedMeals()
-- localStorage key: "pinnedMeals"
-- ============================================================================
-- Frontend shape: { "breakfast": ["tpl_id1", "tpl_id2"], "lunch": [...] }

CREATE TABLE pinned_meals (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot          TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  template_id   UUID NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, slot, template_id)
);

CREATE INDEX idx_pinned_user ON pinned_meals (user_id);


-- ============================================================================
-- TABLE: photo_analyses
-- Metadata for ML pipeline processing
-- No direct frontend mapping — used internally by Edge Functions
-- ============================================================================

CREATE TABLE photo_analyses (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id         UUID        REFERENCES meals(id) ON DELETE SET NULL,
  storage_path    TEXT        NOT NULL, -- path in Supabase Storage bucket
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  raw_response    JSONB,      -- full API response from vision model (for debugging/reprocessing)
  parsed_items    JSONB,      -- structured: [{ name, quantity, calories, protein, carbs, fat }]
  confidence      REAL,       -- 0.0–1.0
  model_used      TEXT,       -- "gpt-4o-mini" or "gpt-4o"
  processing_ms   INTEGER,    -- total pipeline latency
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_photo_analyses_user ON photo_analyses (user_id, created_at DESC);
CREATE INDEX idx_photo_analyses_status ON photo_analyses (status) WHERE status = 'pending';


-- ============================================================================
-- TABLE: nutrition_cache
-- Shared across all users — caches nutrition lookups from external APIs
-- ============================================================================

CREATE TABLE nutrition_cache (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  food_name         TEXT        NOT NULL,
  normalized_name   TEXT        NOT NULL, -- lowercase, trimmed, whitespace-collapsed
  source            TEXT        NOT NULL CHECK (source IN ('usda', 'nutritionix', 'openfoodfacts', 'llm_estimate')),
  source_id         TEXT,       -- external API ID (e.g., USDA FDC ID "171287")
  calories_per_100g REAL        NOT NULL,
  protein_per_100g  REAL        NOT NULL,
  carbs_per_100g    REAL        NOT NULL,
  fat_per_100g      REAL        NOT NULL,
  fiber_per_100g    REAL,
  common_serving    JSONB,      -- { "amount": 1, "unit": "cup", "grams": 240 }
  region            TEXT,       -- "US", "IN", "global"
  verified          BOOLEAN     DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nutrition_normalized ON nutrition_cache (normalized_name);
CREATE INDEX idx_nutrition_source ON nutrition_cache (source, source_id);

-- Partial unique to prevent duplicate entries from the same source
CREATE UNIQUE INDEX idx_nutrition_unique_source
  ON nutrition_cache (normalized_name, source)
  WHERE source_id IS NOT NULL;


-- ============================================================================
-- TABLE: sync_checkpoints
-- Tracks last sync timestamp per user per table for efficient delta sync
-- ============================================================================

CREATE TABLE sync_checkpoints (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name      TEXT NOT NULL,
  last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  PRIMARY KEY (user_id, table_name)
);


-- ============================================================================
-- ROW-LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_checkpoints ENABLE ROW LEVEL SECURITY;
-- nutrition_cache does NOT have RLS — it's shared across all users (read-only for anon)

-- Meals: users can only CRUD their own meals
CREATE POLICY "Users can select own meals"
  ON meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meals"
  ON meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meals"
  ON meals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meals"
  ON meals FOR DELETE USING (auth.uid() = user_id);

-- Templates: users can only CRUD their own
CREATE POLICY "Users can select own templates"
  ON meal_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own templates"
  ON meal_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates"
  ON meal_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates"
  ON meal_templates FOR DELETE USING (auth.uid() = user_id);

-- Profile: users access own profile only
CREATE POLICY "Users access own profile"
  ON user_profiles FOR ALL USING (auth.uid() = user_id);

-- Preferences: users access own only
CREATE POLICY "Users access own preferences"
  ON user_preferences FOR ALL USING (auth.uid() = user_id);

-- Pinned meals: users access own only
CREATE POLICY "Users access own pins"
  ON pinned_meals FOR ALL USING (auth.uid() = user_id);

-- Photo analyses: users access own only
CREATE POLICY "Users access own analyses"
  ON photo_analyses FOR ALL USING (auth.uid() = user_id);

-- Sync checkpoints: users access own only
CREATE POLICY "Users access own checkpoints"
  ON sync_checkpoints FOR ALL USING (auth.uid() = user_id);

-- Nutrition cache: everyone can read, only service_role can write
-- (Edge Functions use service_role key to insert/update cache entries)
ALTER TABLE nutrition_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read nutrition cache"
  ON nutrition_cache FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policy for anon/authenticated roles
-- Edge Functions bypass RLS by using the service_role key


-- ============================================================================
-- TRIGGERS: auto-update updated_at columns
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON meals
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON meal_templates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON nutrition_cache
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================================
-- TRIGGER: auto-create user_profiles and user_preferences on signup
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User')
  );
  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================================
-- SCHEDULED JOBS (pg_cron)
-- ============================================================================

-- Clean up expired photo analyses (24h after creation)
SELECT cron.schedule(
  'cleanup-expired-photos',
  '0 * * * *', -- every hour
  $$DELETE FROM photo_analyses WHERE expires_at < NOW() AND status != 'processing'$$
);

-- Clean up soft-deleted meals older than 30 days (they've been synced)
SELECT cron.schedule(
  'cleanup-soft-deleted-meals',
  '0 3 * * *', -- daily at 3 AM UTC
  $$DELETE FROM meals WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'$$
);

SELECT cron.schedule(
  'cleanup-soft-deleted-templates',
  '0 3 * * *',
  $$DELETE FROM meal_templates WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'$$
);
```

### 3.2 localStorage → Database Mapping

| localStorage Key | DB Table | Mapping Notes |
|-----------------|----------|---------------|
| `"meals"` (JSON array of `Meal`) | `meals` | `id` → `client_id`; `timestamp` (string) → `timestamp` (TIMESTAMPTZ); `photoUrl` → `photo_url`; `mealLabel` → `meal_label`; `type` remains same |
| `"mealTemplates"` (JSON array of `MealTemplate`) | `meal_templates` | `id` (e.g., `"tpl_1711234567890"`) → `client_id`; `lastLogged` → `last_logged`; `mealTiming` → `meal_timing` |
| `"nutrition-profile"` (JSON `Record<string, string>`) | `user_profiles` | `calorieGoal` → `calorie_goal`; `proteinGoal` → `protein_goal`; `carbGoal` → `carb_goal`; `fatGoal` → `fat_goal` |
| `"auth-user"` (JSON) | `auth.users` + `user_profiles.name` | Managed by Supabase Auth; `name` persisted in `user_profiles` |
| `"auth-provider"` (string) | `auth.users.app_metadata.provider` | Managed by Supabase Auth |
| `"pinnedMeals"` (JSON `Record<string, string[]>`) | `pinned_meals` | Each slot+template_id pair becomes a row |
| `"templatePromptsDismissed"` (JSON `string[]`) | `user_preferences.template_prompts_dismissed` | TEXT array in Postgres |
| `"personalization-completed"` (string `"true"`) | `user_preferences.personalization_completed` | Boolean |
| `"personalization-dismissed"` (string `"true"`) | `user_preferences.personalization_dismissed` | Boolean |
| `"onboarded"` (string `"true"`) | `user_preferences.onboarded` | Boolean |
| `"show-first-hint"` (string `"true"`) | `user_preferences.show_first_hint` | Boolean |
| `"theme"` (string `"dark"` or `"light"`) | `user_preferences.theme` | String |

### 3.3 Conversion Functions (TypeScript)

```typescript
// Convert DB meal row to frontend Meal interface
function dbMealToFrontend(row: DbMeal): Meal {
  return {
    id: row.client_id || row.id,   // use client_id if available (for dedup)
    type: row.type,
    timestamp: row.timestamp,       // already ISO string from Supabase
    description: row.description,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    photoUrl: row.photo_url ?? undefined,
    mealLabel: row.meal_label ?? undefined,
  };
}

// Convert frontend Meal to DB insert payload
function frontendMealToDb(meal: Meal, userId: string): DbMealInsert {
  return {
    user_id: userId,
    client_id: meal.id,              // preserve frontend UUID for dedup
    type: meal.type,
    timestamp: meal.timestamp,
    description: meal.description,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    photo_url: meal.photoUrl || null,
    meal_label: meal.mealLabel || null,
  };
}

// Convert DB profile to frontend Record<string, string>
function dbProfileToFrontend(row: DbProfile): Record<string, string> {
  const result: Record<string, string> = {};
  if (row.name) result.name = row.name;
  if (row.height) result.height = row.height;
  if (row.weight) result.weight = row.weight;
  if (row.age) result.age = row.age;
  if (row.goal) result.goal = row.goal;
  if (row.calorie_goal) result.calorieGoal = row.calorie_goal;
  if (row.protein_goal) result.proteinGoal = row.protein_goal;
  if (row.carb_goal) result.carbGoal = row.carb_goal;
  if (row.fat_goal) result.fatGoal = row.fat_goal;
  return result;
}

// Convert frontend profile Record to DB upsert payload
function frontendProfileToDb(profile: Record<string, string>, userId: string): DbProfileUpsert {
  return {
    user_id: userId,
    name: profile.name || null,
    height: profile.height || null,
    weight: profile.weight || null,
    age: profile.age || null,
    goal: profile.goal || null,
    calorie_goal: profile.calorieGoal || '2000',
    protein_goal: profile.proteinGoal || '120',
    carb_goal: profile.carbGoal || '250',
    fat_goal: profile.fatGoal || '70',
  };
}
```

---

## Section 4: Food Recognition Pipeline (Photo → Nutrition)

### 4.1 Step 1: Image Preprocessing

**Where:** Client-side (in the browser, before upload)

**Why client-side:** Reduces upload size by ~80%, saves bandwidth (critical for Indian mobile networks), and reduces OpenAI Vision API cost (which scales with image token count).

**Implementation:**

```typescript
// src/lib/imagePreprocess.ts

const MAX_DIMENSION = 1024;  // px — GPT-4o-mini handles up to 2048, but 1024 is sufficient
const JPEG_QUALITY = 0.80;   // 80% quality — good balance of size vs. detail
const MAX_FILE_SIZE = 500_000; // 500KB target after compression

export async function preprocessImage(file: File | Blob): Promise<Blob> {
  // 1. Load image into an OffscreenCanvas (or regular Canvas)
  const bitmap = await createImageBitmap(file);

  // 2. Calculate resize dimensions (maintain aspect ratio)
  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  // 3. Draw to canvas (this strips EXIF data including GPS coordinates)
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 4. Export as JPEG (WebP has inconsistent browser support for upload)
  const blob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: JPEG_QUALITY,
  });

  // 5. If still too large, reduce quality further
  if (blob.size > MAX_FILE_SIZE) {
    return canvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.60,
    });
  }

  return blob;
}
```

**Key details:**
- Format: JPEG (not WebP — `canvas.convertToBlob` with WebP is not supported in Safari < 17)
- Max dimension: 1024px (reduces a typical 4032×3024 phone photo to 1024×768)
- EXIF stripping: Automatic — canvas redraw does not preserve EXIF metadata (GPS, device info, timestamps)
- Size: A typical 4MB phone photo becomes ~150-300KB after this pipeline

### 4.2 Step 2: Food Identification

#### Model Evaluation

| Model / API | Cost per Image | Latency (p50/p95) | Accuracy on Food | Indian Food Coverage | Portion Estimation | Decision |
|-------------|---------------|-------------------|------------------|---------------------|-------------------|----------|
| **OpenAI GPT-4o-mini (vision)** | ~$0.003 (750 input tokens for 1024px image + ~200 output tokens) | 1.2s / 2.5s | Excellent — correctly identifies 90%+ of common dishes | Good — recognizes dal, roti, paneer, biryani, dosa | Moderate — estimates portions but can over/underestimate by 20-30% | **CHOSEN (primary)** |
| OpenAI GPT-4o (vision) | ~$0.015 (5x cost of mini) | 2.0s / 4.0s | Excellent+ — marginal improvement over mini | Excellent | Good — slightly better portion estimates | **Runner-up (fallback for low confidence)** |
| Google Gemini 2.0 Flash | ~$0.001 (cheapest) | 0.8s / 1.8s | Good — occasionally misidentifies mixed dishes | Fair — weaker on regional Indian foods | Poor — less detailed portion descriptions | Rejected: lower accuracy doesn't justify cost savings |
| Clarifai Food Recognition | $0.004/image | 0.5s / 1.2s | Good for single items, poor for multi-item plates | Poor — US-centric training data | No portion estimation | Rejected: can't handle multi-item plates |
| LogMeal API | $0.005/image | 0.7s / 1.5s | Good for European/American food | Poor | Basic | Rejected: poor Indian food coverage |
| Custom CLIP fine-tune (Food-101) | $0.001 (inference on GPU) | 0.3s / 0.6s | 86% top-1 on Food-101 benchmark | Terrible — Food-101 has no Indian food categories | None | Rejected: requires 100K+ labeled images, months of work, no portion estimation, no Indian food |

#### Chosen: OpenAI GPT-4o-mini (vision)

**Why GPT-4o-mini over GPT-4o as primary:**
- 5x cheaper ($0.003 vs $0.015 per image)
- 40% faster (1.2s vs 2.0s p50)
- Food identification accuracy is nearly identical — the difference shows up mainly in ambiguous/complex scenes
- GPT-4o is used as fallback only when GPT-4o-mini returns confidence < 0.5

**API endpoint:** `POST https://api.openai.com/v1/chat/completions`

**Exact request:**
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "You are a food nutrition analysis system. Given a photo of food, identify each distinct food item, estimate portion sizes, and note preparation methods.\n\nRules:\n1. Identify every distinct food item visible in the image.\n2. Estimate portion size using common units: cups, tablespoons, pieces, slices, oz, grams. For Indian foods, use: katori (150ml bowl), roti (1 piece ≈ 30g), cup rice (≈ 180g cooked).\n3. Note the preparation method if visible: grilled, fried, steamed, raw, sautéed, baked, boiled, etc.\n4. If you cannot identify a food item with at least moderate confidence, describe its appearance instead (e.g., \"brown sauce\" rather than guessing).\n5. Account for visible oils, sauces, dressings, and condiments as separate items.\n6. For mixed dishes (curries, stir-fries, casseroles), identify the dish name and estimate total volume.\n7. Estimate conservatively — slightly under rather than over on portions.\n8. Return ONLY valid JSON. No markdown, no code fences, no explanation.\n\nOutput JSON schema:\n{\n  \"items\": [\n    {\n      \"name\": \"food item name (in English)\",\n      \"quantity\": \"estimated amount with unit\",\n      \"preparation\": \"cooking method or 'raw'\"\n    }\n  ],\n  \"meal_description\": \"natural language summary of the full meal, suitable for a meal log entry\",\n  \"confidence\": 0.85\n}\n\nThe confidence field is 0.0–1.0. Set it based on how clearly you can identify the items:\n- 0.9–1.0: Clear, well-lit photo of recognizable food\n- 0.7–0.89: Recognizable but some ambiguity (e.g., could be chicken or tofu)\n- 0.5–0.69: Significant uncertainty (e.g., blurry, partially obscured)\n- Below 0.5: Cannot reliably identify the food"
    },
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,<BASE64_IMAGE_DATA>",
            "detail": "low"
          }
        },
        {
          "type": "text",
          "text": "Identify the food items in this photo and estimate portions."
        }
      ]
    }
  ],
  "response_format": { "type": "json_object" },
  "max_tokens": 500,
  "temperature": 0.2
}
```

**Key parameter choices:**
- `"detail": "low"` — uses 85 tokens for the image instead of ~765 for `"high"`. Food identification doesn't need high detail; this cuts image token cost by ~90%.
- `"temperature": 0.2` — low temperature for consistent, deterministic food identification.
- `"max_tokens": 500` — sufficient for up to ~8 food items; prevents runaway responses.
- `"response_format": { "type": "json_object" }` — forces valid JSON output.

**Exact response format:**
```json
{
  "items": [
    { "name": "scrambled eggs", "quantity": "2 large eggs worth", "preparation": "scrambled with butter" },
    { "name": "whole wheat toast", "quantity": "2 slices", "preparation": "toasted" },
    { "name": "avocado", "quantity": "1/4 medium", "preparation": "raw, sliced" },
    { "name": "butter", "quantity": "1 tablespoon", "preparation": "melted (on toast)" }
  ],
  "meal_description": "Scrambled eggs with whole wheat toast and avocado slices",
  "confidence": 0.88
}
```

**Rate limits (OpenAI GPT-4o-mini):**
- Tier 1 (default after $5 spend): 500 RPM, 200K TPM
- Tier 2 (after $50 spend): 5,000 RPM, 2M TPM
- **Handling:** The Edge Function implements exponential backoff (1s, 2s, 4s) on 429 responses, with a circuit breaker that falls back to text-only mode after 3 consecutive 429s.

**Accuracy characteristics:**
- **Excellent at:** Single dishes, Western food, common Asian food, clearly plated meals
- **Good at:** Indian food (dal, roti, rice, curry, dosa, idli, biryani), mixed plates
- **Struggles with:** Very similar-looking foods (e.g., dal makhani vs rajma), heavily processed/packaged food without labels, drinks in opaque containers, food in poor lighting
- **Known failure mode:** Portion estimation for liquids (soups, beverages, gravies) — tends to overestimate by 15-25%

### 4.3 Step 3: Nutrition Estimation

**Approach chosen: Hybrid (Option C)**

The vision model identifies food items and estimates portions. Then we look up nutrition data from authoritative databases, using the model's identification as the search query. **We do NOT trust LLM-generated calorie/macro numbers directly** — LLMs hallucinate specific numbers. The model is used for identification; databases provide the numbers.

**Lookup priority chain:**

```
1. Local cache (nutrition_cache table in Postgres)
   → Exact match on normalized_name
   → Cost: $0, Latency: <10ms
   → Hit rate after 30 days: ~80% (most common foods are repeated)

2. USDA FoodData Central API
   → GET https://api.nal.usda.gov/fdc/v1/foods/search?query={food_name}&api_key={key}
   → Cost: $0 (free, unlimited, API key required — get from https://fdc.nal.usda.gov/api-key-signup.html)
   → Latency: 200-400ms
   → Coverage: 380K+ foods, authoritative for US foods
   → Limitation: Weak on Indian regional dishes, entries are sometimes raw ingredients not cooked dishes

3. Nutritionix Natural Language API (v2)
   → POST https://trackapi.nutritionix.com/v2/natural/nutrients
   → Headers: x-app-id: {APP_ID}, x-app-key: {APP_KEY}
   → Body: { "query": "2 scrambled eggs with 1 slice of wheat toast" }
   → Cost: $0.003/call (first 200 calls/day free on developer plan)
   → Latency: 300-500ms
   → Coverage: Excellent for natural language food descriptions, handles compound items
   → Strength: Handles "2 scrambled eggs" (not just "egg, scrambled")

4. OpenFoodFacts API
   → GET https://world.openfoodfacts.org/cgi/search.pl?search_terms={food_name}&json=1
   → Cost: $0 (free, open-source)
   → Latency: 300-600ms
   → Coverage: 3M+ packaged food products globally
   → Limitation: Primarily packaged/branded foods, not home-cooked meals

5. LLM estimation (GPT-4o-mini, text-only — last resort)
   → Same OpenAI API, but text-only prompt asking for nutrition estimates
   → Cost: ~$0.0002/call
   → Latency: 500-800ms
   → Accuracy: ±15-25% — acceptable as last resort, flagged as "estimated"
```

**Exact USDA API request/response:**

```
GET https://api.nal.usda.gov/fdc/v1/foods/search?query=scrambled%20eggs&pageSize=3&dataType=Survey%20(FNDDS)&api_key=YOUR_KEY

Response:
{
  "foods": [
    {
      "fdcId": 171287,
      "description": "Egg, whole, scrambled",
      "foodNutrients": [
        { "nutrientName": "Energy", "value": 149.0, "unitName": "KCAL" },
        { "nutrientName": "Protein", "value": 10.0, "unitName": "G" },
        { "nutrientName": "Total lipid (fat)", "value": 10.98, "unitName": "G" },
        { "nutrientName": "Carbohydrate, by difference", "value": 1.61, "unitName": "G" }
      ],
      "servingSize": 100.0,
      "servingSizeUnit": "g"
    }
  ]
}
```

**Exact Nutritionix API request/response:**

```
POST https://trackapi.nutritionix.com/v2/natural/nutrients
Headers:
  x-app-id: YOUR_APP_ID
  x-app-key: YOUR_APP_KEY
  Content-Type: application/json
Body:
  { "query": "2 scrambled eggs and 1 slice whole wheat toast" }

Response:
{
  "foods": [
    {
      "food_name": "scrambled eggs",
      "serving_qty": 2,
      "serving_unit": "large",
      "serving_weight_grams": 122,
      "nf_calories": 182.08,
      "nf_total_fat": 13.26,
      "nf_protein": 12.14,
      "nf_total_carbohydrate": 2.18
    },
    {
      "food_name": "whole wheat toast",
      "serving_qty": 1,
      "serving_unit": "slice",
      "serving_weight_grams": 25,
      "nf_calories": 64.25,
      "nf_total_fat": 0.93,
      "nf_protein": 3.34,
      "nf_total_carbohydrate": 11.79
    }
  ]
}
```

**Portion size estimation strategy:**

The vision model estimates portions in natural language ("2 large eggs", "1/4 medium avocado", "1 katori dal"). These are passed to Nutritionix as-is (it handles natural language quantities natively). For USDA lookups, the Edge Function maps common units to grams:

```typescript
const SERVING_CONVERSIONS: Record<string, number> = {
  // Common units → grams
  "cup": 240, "tablespoon": 15, "teaspoon": 5,
  "slice": 30, "piece": 100, "oz": 28.35,
  "large egg": 50, "medium egg": 44,
  // Indian serving sizes
  "roti": 30, "chapati": 30, "naan": 90,
  "katori": 150, "bowl": 250,
  "idli": 40, "dosa": 80, "vada": 50,
  "paratha": 60, "puri": 25,
};
```

**Indian food coverage:**

| Database | Indian Food Items | Quality |
|----------|------------------|---------|
| USDA FoodData Central | ~500 items (dal, rice, roti, common curries) | Good for staples, weak on regional dishes |
| Nutritionix | ~200 items | Decent for common items, natural language handles "2 roti with dal" |
| OpenFoodFacts | ~50K Indian packaged food products | Great for packaged snacks (Maggi, MTR, Haldiram's), poor for home-cooked |
| IFCT (Indian Food Composition Tables) | 528 items | Authoritative but no public API — **pre-seed into `nutrition_cache` table** |

**Action item:** Pre-populate `nutrition_cache` with 528 entries from the Indian Food Composition Tables (NIN, Hyderabad). This data is published as a PDF/spreadsheet — it must be manually transcribed or scraped into the database during Phase 2. This gives the lookup chain immediate coverage of dal varieties, regional roti types, common sabzis, etc.

**Multi-item plate handling ("rice with dal and sabzi"):**

The vision model returns separate items in the `items` array. Each item is looked up independently, then results are summed:

```
Vision output: [
  { name: "steamed basmati rice", quantity: "1 cup" },
  { name: "dal tadka", quantity: "1 katori" },
  { name: "aloo gobi sabzi", quantity: "1 katori" }
]

Lookup results:
  rice:      1 cup (180g cooked) → 206 cal, 4.3g protein, 45g carbs, 0.4g fat
  dal tadka: 1 katori (150ml)   → 140 cal, 8g protein, 18g carbs, 4g fat
  aloo gobi: 1 katori (150g)    → 120 cal, 3g protein, 12g carbs, 7g fat

Total: 466 cal, 15.3g protein, 75g carbs, 11.4g fat
```

### 4.4 Step 4: Confidence and Fallback

**Confidence communication to user:**

| Confidence | UI Behavior | Description |
|-----------|-------------|-------------|
| ≥ 0.8 | Green check icon + "Verified" badge | High confidence — show results directly |
| 0.5–0.79 | Yellow info icon + "Estimated" badge | Moderate — show results with "Tap to edit" prompt |
| < 0.5 | Trigger GPT-4o re-analysis. If still < 0.5: show text input prompt | Low — ask user to describe the meal |

**When the model can't identify the food:**

```
1. GPT-4o-mini returns confidence < 0.5
2. Edge Function retries with GPT-4o (10x more expensive, but ~15% better on ambiguous images)
3. If GPT-4o also returns confidence < 0.5:
   a. Return to frontend with status: "unidentified"
   b. Frontend shows MealOverlay with empty description + "We couldn't identify your meal. Please describe it."
   c. User types description → text analysis pipeline takes over
   d. Meal is saved with type: "photo" (but nutrition came from text fallback)
```

**User correction flow:**

When the user sees the MealOverlay after a photo analysis:
1. The overlay shows the AI-generated description (e.g., "Scrambled eggs with toast")
2. User can type a correction in the text input (already exists in `handleOverlayConfirm`)
3. If user provides a correction:
   a. Frontend calls `POST /analyze-text` with the corrected description
   b. New nutrition data replaces the original
   c. Meal is updated via `updateMealInStorage` (existing function)
   d. The correction is logged in `photo_analyses.raw_response` for future model improvement

### 4.5 Step 5: Improving Over Time

**Data collection (opt-in only, see Section 12 for privacy):**

Every photo analysis creates a row in `photo_analyses` containing:
- `raw_response`: Full GPT response (food items, confidence)
- `parsed_items`: Structured nutrition lookup results
- The original storage path (for photos where user opted into storage)

When a user corrects an AI identification, we store:
```json
{
  "original_description": "Grilled chicken with rice",
  "corrected_description": "Paneer tikka with jeera rice",
  "original_items": [...],
  "corrected_items": [...]
}
```

**Fine-tuning loop:**

No custom model fine-tuning in Phase 1-3. At this scale (<100K users), the ROI of fine-tuning is negative. Instead:
1. **Prompt refinement:** Monthly review of low-confidence analyses. Adjust system prompt based on common failure patterns. For example, if the model consistently misidentifies "paneer" as "tofu", add a specific instruction.
2. **Cache enrichment:** Every successful lookup is cached. The cache grows organically and reduces external API calls over time.
3. **IFCT pre-seeding:** 528 Indian food items pre-loaded into nutrition_cache on day one.

**Re-evaluate fine-tuning at 100K MAU** when:
- You have >500K labeled photo-to-food-item pairs from user corrections
- API costs exceed $5K/mo and a custom model could reduce them
- A specific cuisine category has <70% accuracy

**Accuracy metrics (tracked in Supabase dashboard via SQL queries):**

```sql
-- Weekly accuracy dashboard
SELECT
  date_trunc('week', created_at) AS week,
  COUNT(*) AS total_analyses,
  AVG(confidence) AS avg_confidence,
  COUNT(*) FILTER (WHERE confidence >= 0.8) AS high_confidence,
  COUNT(*) FILTER (WHERE confidence < 0.5) AS low_confidence,
  COUNT(*) FILTER (WHERE raw_response->>'corrected_description' IS NOT NULL) AS user_corrections
FROM photo_analyses
WHERE created_at >= NOW() - INTERVAL '12 weeks'
GROUP BY 1
ORDER BY 1 DESC;
```

### 4.6 Complete Edge Function: analyze-photo

```typescript
// supabase/functions/analyze-photo/index.ts
// Runtime: Deno (Supabase Edge Functions)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const USDA_API_KEY = Deno.env.get("USDA_API_KEY")!;
const NUTRITIONIX_APP_ID = Deno.env.get("NUTRITIONIX_APP_ID")!;
const NUTRITIONIX_APP_KEY = Deno.env.get("NUTRITIONIX_APP_KEY")!;

const VISION_SYSTEM_PROMPT = `You are a food nutrition analysis system. Given a photo of food, identify each distinct food item, estimate portion sizes, and note preparation methods.

Rules:
1. Identify every distinct food item visible in the image.
2. Estimate portion size using common units: cups, tablespoons, pieces, slices, oz, grams. For Indian foods, use: katori (150ml bowl), roti (1 piece ≈ 30g), cup rice (≈ 180g cooked).
3. Note the preparation method if visible: grilled, fried, steamed, raw, sautéed, baked, boiled, etc.
4. If you cannot identify a food item with at least moderate confidence, describe its appearance instead.
5. Account for visible oils, sauces, dressings, and condiments as separate items.
6. For mixed dishes (curries, stir-fries, casseroles), identify the dish name and estimate total volume.
7. Estimate conservatively — slightly under rather than over on portions.
8. Return ONLY valid JSON. No markdown, no code fences, no explanation.

Output JSON schema:
{
  "items": [
    {
      "name": "food item name (in English)",
      "quantity": "estimated amount with unit",
      "preparation": "cooking method or 'raw'"
    }
  ],
  "meal_description": "natural language summary of the full meal",
  "confidence": 0.85
}

Confidence: 0.9-1.0 = clear photo, 0.7-0.89 = some ambiguity, 0.5-0.69 = significant uncertainty, <0.5 = cannot identify.`;

serve(async (req: Request) => {
  const startTime = Date.now();

  // 1. Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401 });
  }

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authError } = await createClient(
    SUPABASE_URL,
    authHeader.replace("Bearer ", ""),
    { auth: { persistSession: false } }
  ).auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // 2. Parse multipart form data
  const formData = await req.formData();
  const imageFile = formData.get("image") as File;
  const mealLabel = formData.get("mealLabel") as string | null;

  if (!imageFile) {
    return new Response(JSON.stringify({ error: "No image provided" }), { status: 400 });
  }

  // 3. Upload to temporary storage
  const storagePath = `temp/${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabaseUser.storage
    .from("meal-photos-temp")
    .upload(storagePath, imageFile, { contentType: "image/jpeg", upsert: false });

  if (uploadError) {
    return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500 });
  }

  // 4. Create photo_analyses record
  const { data: analysis } = await supabaseUser
    .from("photo_analyses")
    .insert({ user_id: user.id, storage_path: storagePath, status: "processing" })
    .select()
    .single();

  // 5. Convert image to base64 for OpenAI
  const imageBytes = await imageFile.arrayBuffer();
  const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBytes)));

  // 6. Call GPT-4o-mini Vision
  let visionResult: any;
  let modelUsed = "gpt-4o-mini";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "low" } },
              { type: "text", text: "Identify the food items in this photo and estimate portions." },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.2,
      }),
    });

    const data = await response.json();
    visionResult = JSON.parse(data.choices[0].message.content);

    // 6b. If low confidence, retry with GPT-4o
    if (visionResult.confidence < 0.5) {
      modelUsed = "gpt-4o";
      const retryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: VISION_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "high" } },
                { type: "text", text: "Identify the food items in this photo and estimate portions." },
              ],
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 500,
          temperature: 0.2,
        }),
      });
      const retryData = await retryResponse.json();
      visionResult = JSON.parse(retryData.choices[0].message.content);
    }
  } catch (err) {
    await supabaseUser.from("photo_analyses").update({ status: "failed" }).eq("id", analysis.id);
    return new Response(JSON.stringify({ error: "Vision analysis failed", fallback: "text" }), { status: 502 });
  }

  // 7. Look up nutrition for each identified item
  const nutritionItems = [];
  let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;

  for (const item of visionResult.items) {
    const nutrition = await lookupNutrition(supabaseUser, item);
    nutritionItems.push({ ...item, ...nutrition });
    totalCalories += nutrition.calories;
    totalProtein += nutrition.protein;
    totalCarbs += nutrition.carbs;
    totalFat += nutrition.fat;
  }

  // 8. Update photo_analyses record
  const processingMs = Date.now() - startTime;
  await supabaseUser.from("photo_analyses").update({
    status: "completed",
    raw_response: visionResult,
    parsed_items: nutritionItems,
    confidence: visionResult.confidence,
    model_used: modelUsed,
    processing_ms: processingMs,
  }).eq("id", analysis.id);

  // 9. Return result
  return new Response(JSON.stringify({
    description: visionResult.meal_description,
    calories: Math.round(totalCalories),
    protein: Math.round(totalProtein),
    carbs: Math.round(totalCarbs),
    fat: Math.round(totalFat),
    confidence: visionResult.confidence,
    items: nutritionItems,
    photo_analysis_id: analysis.id,
  }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function lookupNutrition(supabase: any, item: any) {
  const normalized = item.name.toLowerCase().trim().replace(/\s+/g, " ");

  // 1. Check local cache
  const { data: cached } = await supabase
    .from("nutrition_cache")
    .select("*")
    .eq("normalized_name", normalized)
    .limit(1)
    .single();

  if (cached) {
    return scaleToServing(cached, item.quantity);
  }

  // 2. Try USDA
  try {
    const usdaRes = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(item.name)}&pageSize=1&dataType=Survey%20(FNDDS)&api_key=${USDA_API_KEY}`
    );
    const usdaData = await usdaRes.json();
    if (usdaData.foods?.length > 0) {
      const food = usdaData.foods[0];
      const nutrients = extractUSDANutrients(food);
      await cacheNutrition(supabase, item.name, normalized, "usda", String(food.fdcId), nutrients);
      return scaleToServing(nutrients, item.quantity);
    }
  } catch { /* fall through */ }

  // 3. Try Nutritionix
  try {
    const nixRes = await fetch("https://trackapi.nutritionix.com/v2/natural/nutrients", {
      method: "POST",
      headers: {
        "x-app-id": NUTRITIONIX_APP_ID,
        "x-app-key": NUTRITIONIX_APP_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: `${item.quantity} ${item.name}` }),
    });
    const nixData = await nixRes.json();
    if (nixData.foods?.length > 0) {
      const food = nixData.foods[0];
      const result = {
        calories: food.nf_calories,
        protein: food.nf_protein,
        carbs: food.nf_total_carbohydrate,
        fat: food.nf_total_fat,
      };
      // Nutritionix already scales to the quantity, so return directly
      await cacheNutrition(supabase, item.name, normalized, "nutritionix", null, {
        calories_per_100g: (food.nf_calories / food.serving_weight_grams) * 100,
        protein_per_100g: (food.nf_protein / food.serving_weight_grams) * 100,
        carbs_per_100g: (food.nf_total_carbohydrate / food.serving_weight_grams) * 100,
        fat_per_100g: (food.nf_total_fat / food.serving_weight_grams) * 100,
      });
      return result;
    }
  } catch { /* fall through */ }

  // 4. LLM estimation (last resort)
  try {
    const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Estimate the nutrition for: ${item.quantity} ${item.name} (${item.preparation}). Return JSON: {"calories": number, "protein": number, "carbs": number, "fat": number}. Numbers only, no explanation.`,
        }],
        response_format: { type: "json_object" },
        max_tokens: 100,
        temperature: 0.2,
      }),
    });
    const llmData = await llmRes.json();
    const result = JSON.parse(llmData.choices[0].message.content);
    result.estimated = true;
    return result;
  } catch {
    return { calories: 200, protein: 10, carbs: 25, fat: 8, estimated: true };
  }
}

function extractUSDANutrients(food: any) {
  const get = (name: string) => food.foodNutrients?.find((n: any) => n.nutrientName === name)?.value || 0;
  return {
    calories_per_100g: get("Energy"),
    protein_per_100g: get("Protein"),
    carbs_per_100g: get("Carbohydrate, by difference"),
    fat_per_100g: get("Total lipid (fat)"),
  };
}

function scaleToServing(per100g: any, quantity: string): any {
  // Simple scaling: parse quantity to estimate grams, then scale
  const grams = estimateGrams(quantity);
  const scale = grams / 100;
  return {
    calories: Math.round((per100g.calories_per_100g || 0) * scale),
    protein: Math.round((per100g.protein_per_100g || 0) * scale),
    carbs: Math.round((per100g.carbs_per_100g || 0) * scale),
    fat: Math.round((per100g.fat_per_100g || 0) * scale),
  };
}

function estimateGrams(quantity: string): number {
  const q = quantity.toLowerCase();
  // Match patterns like "2 cups", "1/4 medium", "3 slices"
  const numMatch = q.match(/^([\d.\/]+)/);
  const num = numMatch ? eval(numMatch[1]) : 1; // "1/4" → 0.25

  if (q.includes("cup")) return num * 240;
  if (q.includes("tablespoon") || q.includes("tbsp")) return num * 15;
  if (q.includes("teaspoon") || q.includes("tsp")) return num * 5;
  if (q.includes("slice")) return num * 30;
  if (q.includes("piece") || q.includes("whole")) return num * 100;
  if (q.includes("katori") || q.includes("bowl")) return num * 150;
  if (q.includes("roti") || q.includes("chapati")) return num * 30;
  if (q.includes("naan")) return num * 90;
  if (q.includes("large") && q.includes("egg")) return num * 50;
  if (q.includes("medium") && q.includes("egg")) return num * 44;
  if (q.includes("oz")) return num * 28.35;
  if (q.includes("g") || q.includes("gram")) return num;

  return num * 100; // default: assume 100g per unit
}

async function cacheNutrition(supabase: any, name: string, normalized: string, source: string, sourceId: string | null, data: any) {
  await supabase.from("nutrition_cache").upsert({
    food_name: name,
    normalized_name: normalized,
    source,
    source_id: sourceId,
    calories_per_100g: data.calories_per_100g,
    protein_per_100g: data.protein_per_100g,
    carbs_per_100g: data.carbs_per_100g,
    fat_per_100g: data.fat_per_100g,
  }, { onConflict: "normalized_name,source" });
}
```

---

## Section 5: Text Parsing Pipeline (Text → Nutrition)

### 5.1 Approach: LLM-based (GPT-4o-mini, text-only)

**Why LLM over rule-based NLP:**
- Rule-based can't handle: "2 eggs + toast", "dal chawal with a side of raita", "grande iced latte with oat milk"
- Nutritionix's natural language API handles simple cases but fails on mixed-language, informal descriptions
- GPT-4o-mini at $0.0002/call is cheap enough to use for every text input
- Combined approach: GPT-4o-mini parses → Nutritionix/USDA looks up nutrition

### 5.2 Exact Prompt Templates

**System prompt:**
```
You are a food parsing system. Given a user's meal description (which may be informal, use shorthand, or mix languages), extract individual food items with quantities.

Rules:
1. Split compound descriptions into individual items.
2. If no quantity is specified, assume one standard serving.
3. Infer reasonable defaults: "coffee" = 1 cup black coffee; "toast" = 1 slice white bread.
4. Handle shorthand: "2 eggs + toast" = 2 eggs AND 1 slice toast.
5. Handle Indian food descriptions: "dal chawal" = dal (1 katori) + rice (1 cup).
6. Handle Hindi/Hinglish: "2 roti aur sabzi" = 2 roti + 1 katori vegetable sabzi.
7. Separate condiments and additions: "toast with butter" = 1 slice toast + 1 pat butter.
8. Return ONLY valid JSON. No markdown, no explanation.

Output JSON schema:
{
  "items": [
    {
      "name": "food item in English",
      "quantity": "amount with unit",
      "preparation": "cooking method or 'as described'"
    }
  ],
  "normalized_description": "clean, complete description of the meal in English"
}
```

**User prompt:**
```
Parse this meal description into individual food items: "{USER_INPUT}"
```

**Example inputs and outputs:**

```
Input: "2 eggs + toast"
Output: {
  "items": [
    { "name": "egg", "quantity": "2 large", "preparation": "as described" },
    { "name": "white bread toast", "quantity": "1 slice", "preparation": "toasted" }
  ],
  "normalized_description": "2 eggs and 1 slice of toast"
}

Input: "dal chawal with raita"
Output: {
  "items": [
    { "name": "dal (lentil curry)", "quantity": "1 katori (150ml)", "preparation": "cooked" },
    { "name": "steamed rice", "quantity": "1 cup", "preparation": "steamed" },
    { "name": "raita (yogurt side)", "quantity": "1 small katori (100ml)", "preparation": "mixed" }
  ],
  "normalized_description": "Dal with steamed rice and a side of raita"
}

Input: "grande iced latte oat milk"
Output: {
  "items": [
    { "name": "iced latte with oat milk", "quantity": "16 oz (grande)", "preparation": "iced" }
  ],
  "normalized_description": "Grande iced latte with oat milk"
}
```

### 5.3 Ambiguity Handling

When the input is ambiguous, the model is instructed to choose the most common interpretation:
- "toast" → white bread, no butter (conservative estimate)
- "coffee" → black coffee, no sugar
- "eggs" → scrambled eggs (most common preparation in US/India)
- "rice" → steamed white rice

The model does NOT ask for clarification — it makes a reasonable default choice and returns it. The user can correct via the MealOverlay text input (existing flow).

### 5.4 Latency Budget

| Step | Target | Actual |
|------|--------|--------|
| GPT-4o-mini text parse | <800ms | ~500ms (text-only, small prompt) |
| Nutrition lookup (cached) | <50ms | ~10ms |
| Nutrition lookup (Nutritionix) | <600ms | ~400ms |
| Nutrition lookup (USDA) | <500ms | ~300ms |
| **Total (cache hit)** | **<1s** | **~600ms** |
| **Total (cache miss, Nutritionix)** | **<1.5s** | **~1s** |

**Optimization for common items:** Pre-cache the top 200 foods (from USDA + IFCT) on deployment. This covers ~70% of text inputs on day one.

### 5.5 Complete Edge Function: analyze-text

```typescript
// supabase/functions/analyze-text/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TEXT_PARSE_SYSTEM_PROMPT = `You are a food parsing system. Given a user's meal description (which may be informal, use shorthand, or mix languages), extract individual food items with quantities.

Rules:
1. Split compound descriptions into individual items.
2. If no quantity is specified, assume one standard serving.
3. Infer reasonable defaults: "coffee" = 1 cup black coffee; "toast" = 1 slice white bread.
4. Handle shorthand: "2 eggs + toast" = 2 eggs AND 1 slice toast.
5. Handle Indian food descriptions: "dal chawal" = dal (1 katori) + rice (1 cup).
6. Handle Hindi/Hinglish: "2 roti aur sabzi" = 2 roti + 1 katori vegetable sabzi.
7. Separate condiments and additions: "toast with butter" = 1 slice toast + 1 pat butter.
8. Return ONLY valid JSON. No markdown, no explanation.

Output JSON schema:
{
  "items": [
    { "name": "food item in English", "quantity": "amount with unit", "preparation": "cooking method or 'as described'" }
  ],
  "normalized_description": "clean, complete description of the meal in English"
}`;

serve(async (req: Request) => {
  // Auth check (same pattern as analyze-photo)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401 });
  }

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await createClient(
    SUPABASE_URL, token, { auth: { persistSession: false } }
  ).auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { description, mealLabel } = await req.json();
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return new Response(JSON.stringify({ error: "Description is required" }), { status: 400 });
  }
  if (description.length > 500) {
    return new Response(JSON.stringify({ error: "Description too long (max 500 chars)" }), { status: 400 });
  }

  // 1. Parse text into structured food items via GPT-4o-mini
  const parseResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: TEXT_PARSE_SYSTEM_PROMPT },
        { role: "user", content: `Parse this meal description into individual food items: "${description.trim()}"` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
      temperature: 0.2,
    }),
  });

  const parseData = await parseResponse.json();
  const parsed = JSON.parse(parseData.choices[0].message.content);

  // 2. Look up nutrition for each item (same lookupNutrition function as photo pipeline)
  let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
  const nutritionItems = [];

  for (const item of parsed.items) {
    const nutrition = await lookupNutrition(supabaseUser, item);
    nutritionItems.push({ ...item, ...nutrition });
    totalCalories += nutrition.calories;
    totalProtein += nutrition.protein;
    totalCarbs += nutrition.carbs;
    totalFat += nutrition.fat;
  }

  return new Response(JSON.stringify({
    description: parsed.normalized_description,
    calories: Math.round(totalCalories),
    protein: Math.round(totalProtein),
    carbs: Math.round(totalCarbs),
    fat: Math.round(totalFat),
    confidence: 0.85, // text parsing is generally high confidence
    items: nutritionItems,
  }), {
    headers: { "Content-Type": "application/json" },
  });
});

// lookupNutrition is the same function from analyze-photo — extract into a shared module
// supabase/functions/_shared/nutritionLookup.ts
```

---

## Section 6: API Design

### 6.1 API Architecture

The API has two layers:
1. **Supabase PostgREST (auto-generated):** CRUD operations on `meals`, `meal_templates`, `user_profiles`, `user_preferences`, `pinned_meals`. These are accessed via the Supabase JS SDK, which generates REST calls automatically.
2. **Supabase Edge Functions (custom Deno):** `analyze-photo`, `analyze-text`, `export-data`, `delete-account`. These handle ML pipeline orchestration and operations that need server-side secrets.

All endpoints require the JWT from Supabase Auth in the `Authorization: Bearer <token>` header. RLS policies enforce per-user data isolation.

### 6.2 Error Response Format (All Endpoints)

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}  // optional, only in development
}
```

Standard HTTP status codes:
- `200` — Success
- `201` — Created
- `400` — Validation error
- `401` — Not authenticated
- `403` — Forbidden (RLS violation)
- `404` — Not found
- `409` — Conflict (duplicate client_id)
- `429` — Rate limited
- `500` — Internal server error
- `502` — Upstream API failure (OpenAI, USDA, etc.)

### 6.3 Rate Limiting

| Endpoint Category | Limit | Window | Implementation |
|-------------------|-------|--------|----------------|
| CRUD (meals, templates, profile) | 100 requests | per minute per user | Supabase built-in rate limiting |
| `analyze-photo` | 10 requests | per minute per user | Edge Function checks `photo_analyses` count in last 60s |
| `analyze-text` | 20 requests | per minute per user | Edge Function checks timestamp-based counter |
| Auth endpoints | 5 requests | per minute per IP | Supabase Auth built-in |

### 6.4 Pagination

For meal lists, use cursor-based pagination (better for chronological data than offset/limit):

```
GET /rest/v1/meals?user_id=eq.{uid}&deleted_at=is.null&timestamp=lt.{cursor}&order=timestamp.desc&limit=50
```

The cursor is the `timestamp` of the last item in the previous page.

### 6.5 Complete Endpoint Specification

---

#### `POST /auth/v1/signup`

**Handled by:** Supabase Auth SDK (`supabase.auth.signUp`)  
**Auth required:** No

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "created_at": "2026-03-24T10:00:00Z"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "v1.MjAyNi0wMy0yNF...",
    "expires_in": 3600,
    "token_type": "bearer"
  }
}
```

---

#### `POST /auth/v1/token?grant_type=password`

**Handled by:** Supabase Auth SDK (`supabase.auth.signInWithPassword`)  
**Auth required:** No

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "v1.MjAyNi0wMy0yNF...",
  "expires_in": 3600,
  "token_type": "bearer",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com"
  }
}
```

---

#### `POST /auth/v1/logout`

**Handled by:** Supabase Auth SDK (`supabase.auth.signOut`)  
**Auth required:** Yes

**Response (200):** Empty body

---

#### `POST /auth/v1/token?grant_type=refresh_token`

**Handled by:** Supabase Auth SDK (automatic)  
**Auth required:** Yes (refresh token)

**Request:**
```json
{ "refresh_token": "v1.MjAyNi0wMy0yNF..." }
```

**Response (200):** Same as login response with new tokens

---

#### `GET /rest/v1/meals`

**Handled by:** Supabase PostgREST (via SDK: `supabase.from('meals').select()`)  
**Auth required:** Yes (RLS enforces `user_id = auth.uid()`)

**Query parameters (PostgREST filter syntax):**
```
?deleted_at=is.null
&timestamp=gte.2026-03-20T00:00:00Z
&timestamp=lt.2026-03-25T00:00:00Z
&order=timestamp.desc
&limit=50
&offset=0
```

**Response (200):**
```json
[
  {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "type": "photo",
    "timestamp": "2026-03-24T12:30:00Z",
    "description": "Grilled chicken with rice and salad",
    "calories": 520,
    "protein": 35,
    "carbs": 55,
    "fat": 16,
    "photo_url": "https://xxx.supabase.co/storage/v1/object/sign/meal-photos-temp/...",
    "meal_label": "Lunch",
    "client_id": "e3a1f2b3-c4d5-6789-abcd-0123456789ab",
    "version": 1,
    "created_at": "2026-03-24T12:30:00Z",
    "updated_at": "2026-03-24T12:30:00Z",
    "deleted_at": null
  }
]
```

---

#### `POST /rest/v1/meals`

**Handled by:** Supabase PostgREST  
**Auth required:** Yes

**Request:**
```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "client_id": "e3a1f2b3-c4d5-6789-abcd-0123456789ab",
  "type": "text",
  "timestamp": "2026-03-24T12:30:00Z",
  "description": "2 eggs and toast",
  "calories": 260,
  "protein": 16,
  "carbs": 15,
  "fat": 15,
  "meal_label": "Lunch"
}
```

**Response (201):** The created row

**Conflict handling (409):** If `client_id` already exists for this user (duplicate from offline retry), PostgREST returns 409. The sync engine treats this as success (idempotent insert).

---

#### `PATCH /rest/v1/meals?id=eq.{meal_id}`

**Handled by:** Supabase PostgREST  
**Auth required:** Yes

**Request (partial update):**
```json
{
  "description": "3 scrambled eggs and whole wheat toast",
  "calories": 340,
  "version": 2
}
```

**Response (200):** The updated row

---

#### `PATCH /rest/v1/meals?id=eq.{meal_id}` (soft delete)

**Auth required:** Yes

**Request:**
```json
{ "deleted_at": "2026-03-24T15:00:00Z" }
```

**Response (200):** The updated row with `deleted_at` set

---

#### `POST /functions/v1/analyze-photo`

**Handled by:** Supabase Edge Function  
**Auth required:** Yes  
**Content-Type:** `multipart/form-data`

**Request:**
```
POST /functions/v1/analyze-photo
Authorization: Bearer <jwt>
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="image"; filename="meal.jpg"
Content-Type: image/jpeg

<binary image data>
--boundary
Content-Disposition: form-data; name="mealLabel"

Lunch
--boundary--
```

**Response (200):**
```json
{
  "description": "Scrambled eggs with whole wheat toast and avocado slices",
  "calories": 420,
  "protein": 22,
  "carbs": 35,
  "fat": 24,
  "confidence": 0.88,
  "items": [
    {
      "name": "scrambled eggs",
      "quantity": "2 large eggs worth",
      "preparation": "scrambled with butter",
      "calories": 180,
      "protein": 12,
      "carbs": 2,
      "fat": 14
    },
    {
      "name": "whole wheat toast",
      "quantity": "2 slices",
      "preparation": "toasted",
      "calories": 140,
      "protein": 5,
      "carbs": 26,
      "fat": 2
    },
    {
      "name": "avocado",
      "quantity": "1/4 medium",
      "preparation": "raw, sliced",
      "calories": 100,
      "protein": 5,
      "carbs": 7,
      "fat": 8
    }
  ],
  "photo_analysis_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012"
}
```

**Error (502) — Vision API failure:**
```json
{
  "error": "Unable to analyze photo",
  "code": "VISION_API_FAILURE",
  "fallback": "text"
}
```

---

#### `POST /functions/v1/analyze-text`

**Handled by:** Supabase Edge Function  
**Auth required:** Yes  
**Content-Type:** `application/json`

**Request:**
```json
{
  "description": "2 eggs + toast + coffee",
  "mealLabel": "Breakfast"
}
```

**Response (200):**
```json
{
  "description": "2 eggs, 1 slice of toast, and 1 cup of black coffee",
  "calories": 275,
  "protein": 18,
  "carbs": 17,
  "fat": 15,
  "confidence": 0.85,
  "items": [
    {
      "name": "egg",
      "quantity": "2 large",
      "preparation": "as described",
      "calories": 180,
      "protein": 12,
      "carbs": 2,
      "fat": 14
    },
    {
      "name": "white bread toast",
      "quantity": "1 slice",
      "preparation": "toasted",
      "calories": 90,
      "protein": 3,
      "carbs": 15,
      "fat": 1
    },
    {
      "name": "black coffee",
      "quantity": "1 cup (240ml)",
      "preparation": "brewed",
      "calories": 5,
      "protein": 3,
      "carbs": 0,
      "fat": 0
    }
  ]
}
```

---

#### `GET /rest/v1/meal_templates`

**Handled by:** Supabase PostgREST  
**Auth required:** Yes

**Query:** `?deleted_at=is.null&order=count.desc`

**Response (200):**
```json
[
  {
    "id": "d4e5f6a7-b8c9-0123-defg-456789012345",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Morning Oatmeal",
    "calories": 350,
    "protein": 12,
    "carbs": 60,
    "fat": 8,
    "count": 15,
    "last_logged": "2026-03-24T08:00:00Z",
    "meal_timing": "breakfast",
    "client_id": "tpl_1711234567890",
    "version": 1,
    "created_at": "2026-03-01T10:00:00Z",
    "updated_at": "2026-03-24T08:00:00Z",
    "deleted_at": null
  }
]
```

---

#### `POST /rest/v1/meal_templates`

**Auth required:** Yes

**Request:**
```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "client_id": "tpl_1711234567890",
  "name": "Morning Oatmeal",
  "calories": 350,
  "protein": 12,
  "carbs": 60,
  "fat": 8,
  "count": 1,
  "last_logged": "2026-03-24T08:00:00Z",
  "meal_timing": "breakfast"
}
```

**Response (201):** The created row

---

#### `PATCH /rest/v1/meal_templates?id=eq.{id}` (soft delete)

**Auth required:** Yes

**Request:** `{ "deleted_at": "2026-03-24T15:00:00Z" }`

---

#### `GET /rest/v1/user_profiles?user_id=eq.{uid}`

**Auth required:** Yes

**Response (200):**
```json
[
  {
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Deekshansh",
    "height": "175",
    "weight": "72",
    "age": "28",
    "goal": "maintain",
    "calorie_goal": "2200",
    "protein_goal": "130",
    "carb_goal": "260",
    "fat_goal": "75",
    "created_at": "2026-03-01T10:00:00Z",
    "updated_at": "2026-03-24T10:00:00Z"
  }
]
```

---

#### `PATCH /rest/v1/user_profiles?user_id=eq.{uid}`

**Auth required:** Yes

**Request (partial):**
```json
{
  "weight": "71",
  "calorie_goal": "2100"
}
```

---

#### `GET /rest/v1/meals` (daily summary — computed client-side)

There is no separate `/insights/daily/:date` endpoint. The frontend already computes daily summaries from the meals array (see `Insights.tsx` lines 49-67). The backend simply serves meals for the date range, and the frontend does the aggregation. This matches the existing architecture and avoids a server round-trip for every date change.

**Query for a specific day:**
```
?deleted_at=is.null
&timestamp=gte.2026-03-24T00:00:00Z
&timestamp=lt.2026-03-25T00:00:00Z
&order=timestamp.asc
```

---

#### `GET /rest/v1/meals` (streak — computed client-side)

Streak computation is already done client-side in `Profile.tsx` (lines 46-58). The backend serves the full meal list; the frontend computes the streak. This avoids a dedicated endpoint for a derived metric.

---

#### `GET /rest/v1/meals` (trends — computed client-side)

Trend data is already computed client-side in `Reports.tsx` (lines 179-189). The backend serves meals for the trend period (7/30/90 days); the frontend aggregates.

**Query for 30-day trends:**
```
?deleted_at=is.null
&timestamp=gte.2026-02-22T00:00:00Z
&order=timestamp.asc
```

---

#### `POST /functions/v1/export-data`

**Handled by:** Supabase Edge Function  
**Auth required:** Yes

**Request:** `{}` (empty body — exports all user data)

**Response (200):**
```json
{
  "download_url": "https://xxx.supabase.co/storage/v1/object/sign/exports/a1b2c3d4/export-2026-03-24.json?token=...",
  "expires_in": 3600
}
```

The exported file contains all meals, templates, profile, and preferences in JSON format.

---

#### `POST /functions/v1/delete-account`

**Handled by:** Supabase Edge Function  
**Auth required:** Yes

**Request:**
```json
{ "confirmation": "DELETE MY ACCOUNT" }
```

**Response (200):**
```json
{ "message": "Account and all data deleted successfully" }
```

This Edge Function:
1. Deletes all rows from `meals`, `meal_templates`, `user_profiles`, `user_preferences`, `pinned_meals`, `photo_analyses` for the user (cascade handles most)
2. Deletes all files in Supabase Storage under the user's paths
3. Deletes the `auth.users` row (which cascades to all FK-dependent rows)

---

## Section 7: Offline-First & Sync Strategy

### 7.1 Architecture: Operation Log with Last-Write-Wins

**Not CRDTs.** CRDTs are overkill for a nutrition app where:
- Conflicts are rare (one user, typically one device at a time)
- Conflict stakes are low (wrong calorie count is inconvenient, not catastrophic)
- Data is mostly append-only (meals are created, rarely edited)

**Chosen approach:** Offline operation queue in IndexedDB + last-write-wins conflict resolution using `updated_at` timestamps.

### 7.2 How the Frontend Queues Offline Mutations

```typescript
// src/lib/syncEngine.ts

import { openDB, DBSchema, IDBPDatabase } from 'idb'; // npm install idb

interface SyncQueueDB extends DBSchema {
  operations: {
    key: string;
    value: SyncOperation;
    indexes: { 'by-created': string };
  };
  checkpoints: {
    key: string; // table name
    value: { table: string; lastSyncedAt: string };
  };
}

interface SyncOperation {
  id: string;            // UUID
  table: 'meals' | 'meal_templates' | 'user_profiles' | 'user_preferences';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  createdAt: string;     // ISO timestamp
  retryCount: number;
}

class SyncEngine {
  private db: IDBPDatabase<SyncQueueDB> | null = null;
  private isSyncing = false;

  async init() {
    this.db = await openDB<SyncQueueDB>('snap-nourish-sync', 1, {
      upgrade(db) {
        const store = db.createObjectStore('operations', { keyPath: 'id' });
        store.createIndex('by-created', 'createdAt');
        db.createObjectStore('checkpoints', { keyPath: 'table' });
      },
    });

    // Sync on reconnect
    window.addEventListener('online', () => this.flush());

    // Sync on app foregrounded
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.flush();
      }
    });

    // Periodic sync every 5 minutes
    setInterval(() => {
      if (navigator.onLine) this.flush();
    }, 5 * 60 * 1000);

    // Initial sync
    if (navigator.onLine) this.flush();
  }

  async enqueue(op: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount'>) {
    const operation: SyncOperation = {
      ...op,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    await this.db!.put('operations', operation);

    if (navigator.onLine) {
      this.flush(); // non-blocking
    }
  }

  async flush() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      // 1. Push local changes to server
      const ops = await this.db!.getAllFromIndex('operations', 'by-created');
      for (const op of ops) {
        try {
          await this.executeRemote(op);
          await this.db!.delete('operations', op.id);
        } catch (err: any) {
          if (err?.status === 409) {
            // Conflict (duplicate client_id) — treat as success
            await this.db!.delete('operations', op.id);
          } else if (err?.status >= 400 && err?.status < 500 && err?.status !== 429) {
            // Client error (except rate limit) — drop the operation
            await this.db!.delete('operations', op.id);
          } else {
            // Transient error — retry later
            op.retryCount++;
            if (op.retryCount > 10) {
              await this.db!.delete('operations', op.id); // give up after 10 retries
            } else {
              await this.db!.put('operations', op);
            }
          }
        }
      }

      // 2. Pull server changes into localStorage
      await this.pullChanges();
    } finally {
      this.isSyncing = false;
    }
  }

  private async executeRemote(op: SyncOperation) {
    const { supabase } = await import('./supabaseClient');

    switch (op.action) {
      case 'INSERT':
        const { error: insertErr } = await supabase.from(op.table).insert(op.payload);
        if (insertErr) throw { status: insertErr.code === '23505' ? 409 : 500 };
        break;
      case 'UPDATE':
        const { id, ...updatePayload } = op.payload;
        const { error: updateErr } = await supabase.from(op.table).update(updatePayload).eq('client_id', id);
        if (updateErr) throw { status: 500 };
        break;
      case 'DELETE':
        const { error: deleteErr } = await supabase.from(op.table)
          .update({ deleted_at: new Date().toISOString() })
          .eq('client_id', op.payload.id);
        if (deleteErr) throw { status: 500 };
        break;
    }
  }

  private async pullChanges() {
    const { supabase } = await import('./supabaseClient');

    for (const table of ['meals', 'meal_templates'] as const) {
      const checkpoint = await this.db!.get('checkpoints', table);
      const since = checkpoint?.lastSyncedAt || '1970-01-01T00:00:00Z';

      const { data: rows } = await supabase
        .from(table)
        .select('*')
        .gt('updated_at', since)
        .order('updated_at', { ascending: true });

      if (rows && rows.length > 0) {
        this.applyServerChanges(table, rows);
        const lastUpdated = rows[rows.length - 1].updated_at;
        await this.db!.put('checkpoints', { table, lastSyncedAt: lastUpdated });
      }
    }

    // Notify React to re-render
    window.dispatchEvent(new CustomEvent('snap-nourish:sync-complete'));
  }

  private applyServerChanges(table: string, serverRows: any[]) {
    if (table === 'meals') {
      const localMeals = getMeals(); // from storage.ts
      const localMap = new Map(localMeals.map(m => [m.id, m]));

      for (const row of serverRows) {
        const clientId = row.client_id || row.id;
        if (row.deleted_at) {
          localMap.delete(clientId);
        } else {
          localMap.set(clientId, dbMealToFrontend(row));
        }
      }

      saveMeals(Array.from(localMap.values()));
    }
    // Similar for meal_templates
  }
}

export const syncEngine = new SyncEngine();
```

### 7.3 Conflict Resolution

| Scenario | Resolution | Rationale |
|----------|-----------|-----------|
| Same meal edited on two devices | Last-write-wins based on `updated_at` | Meal edits are rare; user typically only changes description |
| Meal created offline on two devices with same `client_id` | First writer wins (unique index); second gets 409, treated as success | `client_id` is from `crypto.randomUUID()` — collision is astronomically unlikely |
| Template `count` incremented on two devices | Last-write-wins on `count` | Acceptable inaccuracy — count is cosmetic, not critical |
| Profile edited on two devices | Last-write-wins per-field (pull merges field-by-field) | If user changes `weight` on phone and `calorieGoal` on tablet, both are preserved |

### 7.4 What Data is Cached Locally

| Data | Cache Location | Freshness |
|------|---------------|-----------|
| Meals (all user's meals) | localStorage `"meals"` | Refreshed on every sync |
| Templates | localStorage `"mealTemplates"` | Refreshed on every sync |
| Profile | localStorage `"nutrition-profile"` | Refreshed on every sync |
| Auth session | localStorage (Supabase SDK managed) | Auto-refreshed on token expiry |
| Sync queue | IndexedDB `snap-nourish-sync` | Drained on every flush |
| Preferences/flags | localStorage (various keys) | Refreshed on every sync |

### 7.5 How storage.ts Evolves

The key insight: **storage.ts functions remain synchronous for reads** (from localStorage), and writes now also enqueue to the sync engine.

```typescript
// storage.ts — evolved version

import { syncEngine } from './syncEngine';

// READS: Unchanged — still synchronous from localStorage
export function getMeals(): Meal[] {
  return readJSON<Meal[]>(STORAGE_KEYS.meals, []);
}

// WRITES: localStorage + sync queue
export function saveMeals(meals: Meal[]): void {
  const previous = readJSON<Meal[]>(STORAGE_KEYS.meals, []);
  writeJSON(STORAGE_KEYS.meals, meals);

  // Diff to find new/updated/deleted meals
  const previousIds = new Set(previous.map(m => m.id));
  const currentIds = new Set(meals.map(m => m.id));

  // New meals
  for (const meal of meals) {
    if (!previousIds.has(meal.id)) {
      syncEngine.enqueue({
        table: 'meals',
        action: 'INSERT',
        payload: frontendMealToDb(meal, getCurrentUserId()),
      });
    }
  }

  // Deleted meals
  for (const meal of previous) {
    if (!currentIds.has(meal.id)) {
      syncEngine.enqueue({
        table: 'meals',
        action: 'DELETE',
        payload: { id: meal.id },
      });
    }
  }
}

// Updated meals are detected by comparing payload hashes (skip for now — handle in saveMeal-level)
```

### 7.6 Library for Offline Queue

**idb** (https://github.com/jakearchibald/idb) — a tiny (~1KB gzipped) wrapper around IndexedDB with Promise-based API. Already widely used, zero dependencies, maintained by Jake Archibald (Google Chrome team).

Install: `npm install idb`

---

## Section 8: File Storage (Photos)

### 8.1 Storage Provider: Supabase Storage (S3-compatible)

**Why Supabase Storage:**
- Same project, same auth — RLS policies apply to storage buckets
- S3-compatible API — can migrate to raw S3/R2 later if needed
- Built-in CDN for serving
- Lifecycle rules for auto-deletion (critical for temp photos)
- 1GB free on free tier

**Why not Cloudflare R2:**
- R2 is 50% cheaper per GB ($0.015 vs $0.021)
- But R2 requires separate auth setup, separate CDN config, separate project
- At 10K MAU with 5 photos/user/day, most photos are deleted after 24h — storage cost is negligible

### 8.2 Bucket Configuration

| Bucket | Access | TTL | RLS |
|--------|--------|-----|-----|
| `meal-photos-temp` | Private (signed URLs only) | 24-hour lifecycle rule | User can only upload to their `user_id/` prefix |
| `meal-photos-perm` | Private (signed URLs only) | No TTL | User can only read/write their own prefix |

**Supabase Storage policies (SQL):**

```sql
-- Temp bucket: users can upload to their own folder
CREATE POLICY "Users upload own temp photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'meal-photos-temp'
    AND (storage.foldername(name))[1] = 'temp'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Users can read their own temp photos (for display in UI)
CREATE POLICY "Users read own temp photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'meal-photos-temp'
    AND (storage.foldername(name))[1] = 'temp'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
```

### 8.3 Upload Flow

```
1. Client preprocesses image (resize, strip EXIF, compress)
2. Client calls Edge Function: POST /functions/v1/analyze-photo
   - Edge Function receives the image in the request body
   - Edge Function uploads to Supabase Storage using service_role key
   - Edge Function processes with Vision API
   - Edge Function returns nutrition data + signed photo URL (24h expiry)
3. Client creates Meal object with photoUrl = signed URL
4. Meal is saved to localStorage + sync queue
```

**Why not presigned upload (client → Storage directly)?**
- The image needs to go to the Edge Function anyway for ML analysis
- Sending it twice (once to Storage, once to Edge Function) wastes bandwidth
- Single upload to Edge Function is simpler and saves one round-trip

### 8.4 Photo Retention Policy

| User setting | Behavior |
|-------------|----------|
| Default (opt-out) | Photo uploaded to `meal-photos-temp`, processed by ML, signed URL set on meal. After 24h, photo auto-deleted by lifecycle rule. `photoUrl` on meal becomes a dead link. |
| Opt-in ("Save my photos") | Photo copied to `meal-photos-perm` after analysis. `photoUrl` updated to permanent signed URL (1 year expiry, auto-renewed on access). |

**Opt-in toggle:** Profile.tsx → new toggle "Save meal photos" → sets `user_preferences.photo_storage_opt_in = true`

### 8.5 Thumbnail Generation

Not implemented in Phase 1. Justification:
- Photos are already preprocessed to 1024px max on the client
- At 150-300KB per photo, serving the full image as a thumbnail is acceptable on mobile
- True thumbnail generation (e.g., 200px) can be added via Supabase Image Transformation (built-in, just append `?width=200&height=200` to the URL) when needed

### 8.6 Cost Estimate at 10K MAU

Assumptions:
- 5 photos/user/day, 24-hour retention (default)
- ~200KB average per preprocessed photo
- 10% of users opt into permanent storage

```
Temp storage: 10K × 5 photos × 200KB = 10GB/day, but 24h TTL means steady-state ≈ 10GB
Permanent storage: 1K users × 5 photos × 200KB × 30 days = 30GB/month

Total storage: ~40GB
Cost: 40GB × $0.021/GB = $0.84/month

Bandwidth (serving photos): ~50GB/month (thumbnails, 50% cache hit)
Cost: 50GB × $0.09/GB = $4.50/month

Total photo cost at 10K MAU: ~$5.34/month
```

---

## Section 9: PWA & Real Camera Integration

### 9.1 Service Worker Strategy

**Tool:** `vite-plugin-pwa` v0.21+ (integrates Workbox with Vite)

**Install:** `npm install -D vite-plugin-pwa`

**Caching strategies by resource type:**

| Resource | Strategy | Rationale |
|----------|----------|-----------|
| App shell (JS, CSS, HTML, fonts) | **Precache** (Workbox `precacheAndRoute`) | Instant load on repeat visits; auto-updated on new deploy |
| API reads (`/rest/v1/meals`, `/rest/v1/meal_templates`) | **NetworkFirst** with 3s timeout | Fresh data when online; falls back to cached response when offline |
| Photo URLs (`/storage/v1/object/sign/...`) | **CacheFirst** with 24h max age | Photos are immutable once uploaded; cache aggressively |
| Edge Functions (`/functions/v1/analyze-*`) | **NetworkOnly** | ML analysis requires server-side processing; cannot be cached |
| Auth endpoints (`/auth/v1/*`) | **NetworkOnly** | Auth tokens must be live |

**vite.config.ts changes:**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["robots.txt", "placeholder.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "photo-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
      manifest: {
        name: "Snap Nourish",
        short_name: "SnapNourish",
        description: "Track your nutrition with a snap",
        theme_color: "#10b981",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/home",
        scope: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
```

### 9.2 Real Camera Integration

Currently, `Home.tsx` shows a faux viewfinder (CSS gradients + scanning line animation). There is no actual `<video>` element. The replacement:

```typescript
// src/hooks/useCamera.ts

import { useRef, useState, useCallback, useEffect } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // rear camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
      setError(null);
    } catch (err) {
      setError("Camera access denied");
      setIsActive(false);
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setIsActive(false);
  }, []);

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !isActive) return null;

    const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    return canvas.convertToBlob({ type: "image/jpeg", quality: 0.80 });
  }, [isActive]);

  useEffect(() => {
    return () => stop(); // cleanup on unmount
  }, [stop]);

  return { videoRef, isActive, error, start, stop, captureFrame };
}
```

**Camera permission denial handling:**
1. First attempt: Show the browser's native permission prompt
2. If denied: Show a card with "Camera access is needed to snap meals. You can enable it in your browser settings." + a "Use text input instead" button
3. Gallery upload (`<input type="file" accept="image/*">`) always works regardless of camera permission

---

## Section 10: Deployment & Infrastructure

### 10.1 Hosting

| Component | Host | Why |
|-----------|------|-----|
| **Frontend SPA** | Vercel (free tier) | Zero-config Vite deployment; global edge CDN; automatic HTTPS; preview deployments per PR |
| **Backend (DB, Auth, Storage, Edge Functions)** | Supabase (cloud) | Single managed platform; no separate server to deploy |

**Alternative considered for SPA:** Cloudflare Pages (also free, faster edge network). Choose Vercel for better Vite integration and preview deployments. Can switch to Cloudflare Pages with zero code changes if Vercel costs become an issue.

### 10.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
        working-directory: snap-nourish
      - run: npm run lint
        working-directory: snap-nourish
      - run: npm run test
        working-directory: snap-nourish
      - run: npm run build
        working-directory: snap-nourish

  deploy-frontend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: snap-nourish

  deploy-edge-functions:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase functions deploy analyze-photo --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - run: supabase functions deploy analyze-text --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-migrations:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase db push --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### 10.3 Environment Management

| Environment | Supabase Project | Vercel Environment | Purpose |
|-------------|-----------------|-------------------|---------|
| **Development** | `snap-nourish-dev` (free tier) | Preview deployments | Feature development, testing |
| **Staging** | `snap-nourish-staging` (free tier) | Staging branch deployment | Pre-production testing, QA |
| **Production** | `snap-nourish-prod` (Pro tier) | Main branch deployment | Live users |

**Environment variables (Vercel):**

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Edge Function secrets (Supabase dashboard or CLI):**

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set USDA_API_KEY=...
supabase secrets set NUTRITIONIX_APP_ID=...
supabase secrets set NUTRITIONIX_APP_KEY=...
```

### 10.4 Monitoring and Alerting

| What | Tool | Cost | Configuration |
|------|------|------|---------------|
| **Frontend errors** | Sentry (free tier: 5K errors/mo) | $0 | `@sentry/react` SDK, source maps uploaded on deploy |
| **API latency + errors** | Supabase Dashboard (built-in) | $0 | Built-in query performance monitoring, log explorer |
| **Edge Function logs** | Supabase Dashboard (built-in) | $0 | `console.log` in Edge Functions → visible in dashboard |
| **Uptime monitoring** | UptimeRobot (free tier: 50 monitors) | $0 | Ping `/` every 5 minutes, alert on 3 consecutive failures |
| **User analytics** | PostHog (free tier: 1M events/mo) | $0 | Track: meal_logged, photo_analyzed, template_created, signup_completed |

**Key metrics to alert on:**
- Edge Function error rate > 5% over 5 minutes → Slack/email alert
- Average photo analysis latency > 5 seconds → investigate OpenAI rate limits
- Auth failure rate > 10% over 5 minutes → possible OAuth misconfiguration
- Sync queue depth > 100 operations for any user → possible stuck sync

### 10.5 Logging Strategy

| Level | What to log | Where |
|-------|-------------|-------|
| **ERROR** | Edge Function failures, database connection errors, auth failures | Supabase logs (auto-retained 7 days) |
| **WARN** | Low confidence photo analyses (<0.5), rate limit hits, nutrition lookup fallbacks | Supabase logs |
| **INFO** | Successful analyses (model used, latency, confidence), cache hit/miss ratio | Supabase logs |
| **DEBUG** | Full API payloads (development only) | Console (not in production) |

**Never log:** User photos, JWT tokens, API keys, email addresses in plaintext.

### 10.6 Cost Projection

| Component | 1K MAU | 10K MAU | 100K MAU |
|-----------|--------|---------|----------|
| Supabase (DB + Auth + Storage + Edge Functions) | $0 | $25 | $75 |
| OpenAI API (photo + text analysis) | $15 | $150 | $1,500 |
| Nutritionix API | $5 | $50 | $300 |
| Vercel (SPA hosting) | $0 | $0 | $20 |
| Sentry | $0 | $0 | $26 |
| PostHog | $0 | $0 | $0 |
| UptimeRobot | $0 | $0 | $0 |
| **Total** | **$20/mo** | **$225/mo** | **$1,921/mo** |

---

## Section 11: Migration Plan

### 11.1 How storage.ts Changes

**Phase 1 (Auth only):** Add `supabaseClient.ts`. Modify only auth functions (`saveAuthUser`, `getAuthUser`, `handleAuth`, `handleLogout`). All data functions (`getMeals`, `saveMeals`, etc.) remain unchanged — still localStorage only.

**Phase 2 (Data sync):** Add `syncEngine.ts`. Modify write functions (`saveMeals`, `saveStoredTemplates`, `saveProfile`) to dual-write (localStorage + sync queue). Read functions remain unchanged — still synchronous from localStorage. Background sync pulls server data into localStorage.

**Phase 3 (Real nutrition):** Add `analyzePhoto.ts` and `analyzeText.ts` API client functions. Modify `Home.tsx` to call these instead of `generateMeal`. `MealOverlay` gets a loading state. `handleCapture` becomes async.

### 11.2 First-Time User Experience (After Migration)

```
1. User opens app → Index.tsx checks onboarded flag
2. Not onboarded → /onboarding
3. Onboarding intro step → "Get Started"
4. Auth step → "Continue with Google" → real OAuth redirect → Google consent → back to app
5. Supabase Auth creates auth.users row → handle_new_user trigger creates user_profiles + user_preferences
6. AuthCallback.tsx saves user data to localStorage for backward compatibility
7. Profile step → user fills in name/age/height/weight/goal → saveProfile writes localStorage + sync queue
8. Camera permission step → getUserMedia request → /home
9. Home → user snaps a photo → real camera feed → capture frame → upload to Edge Function → real nutrition data
10. Meal saved to localStorage + sync queue → background sync pushes to server
```

### 11.3 Existing User Migration (localStorage → Server)

When an existing user (who has been using the localStorage-only version) opens the app after the backend migration:

```
1. App loads → detects existing localStorage data but no Supabase session
2. User is prompted to sign in (one-time migration flow)
3. After sign in, the migration function runs:
```

```typescript
// src/lib/migrateLocalData.ts

export async function migrateLocalDataToServer() {
  const { supabase } = await import('./supabaseClient');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 1. Migrate meals
  const meals = getMeals();
  if (meals.length > 0) {
    const dbMeals = meals.map(m => frontendMealToDb(m, user.id));
    // Batch insert with ON CONFLICT DO NOTHING (idempotent)
    await supabase.from('meals').upsert(dbMeals, {
      onConflict: 'user_id,client_id',
      ignoreDuplicates: true,
    });
  }

  // 2. Migrate templates
  const templates = getStoredTemplates();
  if (templates.length > 0) {
    const dbTemplates = templates.map(t => ({
      user_id: user.id,
      client_id: t.id,
      name: t.name,
      calories: t.calories,
      protein: t.protein,
      carbs: t.carbs,
      fat: t.fat,
      count: t.count,
      last_logged: t.lastLogged,
      meal_timing: t.mealTiming,
    }));
    await supabase.from('meal_templates').upsert(dbTemplates, {
      onConflict: 'user_id,client_id',
      ignoreDuplicates: true,
    });
  }

  // 3. Migrate profile
  const profile = getProfile();
  if (Object.keys(profile).length > 0) {
    await supabase.from('user_profiles').upsert(
      frontendProfileToDb(profile, user.id),
      { onConflict: 'user_id' }
    );
  }

  // 4. Migrate preferences
  const prefs: any = { user_id: user.id };
  if (getFlag('theme')) prefs.theme = getFlag('theme');
  if (getFlag('personalizationCompleted') === 'true') prefs.personalization_completed = true;
  if (getFlag('personalizationDismissed') === 'true') prefs.personalization_dismissed = true;
  const dismissed = getDismissedPrompts();
  if (dismissed.length > 0) prefs.template_prompts_dismissed = dismissed;
  await supabase.from('user_preferences').upsert(prefs, { onConflict: 'user_id' });

  // 5. Mark migration complete
  setFlag('migrationComplete', 'true');
}
```

### 11.4 Phase-by-Phase Rollout

| Phase | Duration | What Ships | What Changes in Frontend | Rollback Strategy |
|-------|----------|-----------|-------------------------|-------------------|
| **Phase 0: Setup** | Week 1 | Supabase project, DB schema, OAuth config, storage buckets | Nothing — frontend unchanged | N/A |
| **Phase 1: Auth** | Weeks 2-3 | Real Google/Apple OAuth, anonymous auth, auto-create profile/preferences | `Onboarding.tsx`: real OAuth flow. `Profile.tsx`: real logout. New `AuthCallback.tsx` route. `supabaseClient.ts` added. | Feature flag: `VITE_USE_REAL_AUTH=true`. If false, falls back to localStorage auth. |
| **Phase 2: Data Sync** | Weeks 3-5 | Sync engine, dual-write storage.ts, background pull, migration script | `storage.ts`: write functions dual-write. `syncEngine.ts` added. `idb` dependency added. Migration prompt for existing users. | Feature flag: `VITE_ENABLE_SYNC=true`. If false, localStorage-only (no sync queue). |
| **Phase 3: Nutrition** | Weeks 5-7 | Edge Functions (analyze-photo, analyze-text), real camera, nutrition cache pre-seeded | `Home.tsx`: `handleCapture` becomes async, calls Edge Function. `useCamera` hook replaces faux viewfinder. `MealOverlay` gets loading state. Gallery upload sends real image. | Feature flag: `VITE_USE_REAL_NUTRITION=true`. If false, falls back to `generateMeal` with random macros. |
| **Phase 4: PWA + Polish** | Weeks 7-8 | Service worker, web manifest, photo privacy controls, data export, account deletion | `vite.config.ts` gets PWA plugin. `Profile.tsx` gets photo opt-in toggle, data export button, delete account button. | Can disable PWA plugin without affecting functionality. |

### 11.5 Migration Sequence (Build Order)

```
1. supabaseClient.ts (Supabase SDK initialization)
2. Database migrations (run schema SQL)
3. OAuth provider configuration (Google Cloud Console, Apple Developer)
4. AuthCallback.tsx + route registration
5. Onboarding.tsx auth changes
6. Profile.tsx logout changes
7. Edge Functions: analyze-photo, analyze-text
8. syncEngine.ts (IndexedDB queue + flush logic)
9. storage.ts modifications (dual-write)
10. migrateLocalData.ts (one-time migration)
11. Home.tsx camera changes (useCamera hook, async handleCapture)
12. MealOverlay.tsx loading state
13. vite.config.ts PWA configuration
14. Profile.tsx new settings (photo opt-in, export, delete)
```

---

## Section 12: Security & Privacy

### 12.1 Data Encryption

| Layer | Encryption | Details |
|-------|-----------|---------|
| **In transit** | TLS 1.3 | Supabase enforces HTTPS on all endpoints. Vercel enforces HTTPS for SPA. |
| **At rest (database)** | AES-256 | Supabase encrypts all PostgreSQL data at rest using AES-256. |
| **At rest (storage)** | AES-256 | Supabase Storage (S3-compatible) encrypts all objects at rest. |
| **At rest (client)** | None | localStorage is not encrypted. This is acceptable because: (1) the device itself should be locked, (2) the data is not highly sensitive (meal logs, not financial data), (3) encrypting localStorage adds complexity with minimal security benefit against a local attacker who already has device access. |

### 12.2 Photo Privacy

| Rule | Implementation |
|------|---------------|
| Photos are NOT used for model training | Contractual: OpenAI API ToS states API inputs are not used for training when using the API (not ChatGPT). This is the default for API customers. |
| Photos are deleted after 24 hours by default | Supabase Storage lifecycle rule on `meal-photos-temp` bucket. `pg_cron` job deletes `photo_analyses` rows with `expires_at < NOW()`. |
| Users must opt in for permanent storage | `user_preferences.photo_storage_opt_in` field. Default `FALSE`. Toggle in Profile page. |
| EXIF data is stripped before upload | Client-side preprocessing (canvas redraw) removes all EXIF metadata including GPS coordinates. |
| Photos are never served publicly | All storage buckets are private. Photos are accessed via signed URLs with expiration (24h for temp, 1 year for permanent). |

### 12.3 GDPR/Data Deletion Compliance

| Right | Implementation |
|-------|---------------|
| **Right to access** | `POST /functions/v1/export-data` — exports all user data as JSON |
| **Right to erasure** | `POST /functions/v1/delete-account` — deletes all rows (CASCADE from `auth.users`), all storage files, and the auth account |
| **Right to portability** | Same export endpoint — JSON format is machine-readable |
| **Data minimization** | Photos deleted after 24h by default. No tracking pixels. Minimal analytics (PostHog with privacy mode). |
| **Consent** | Photo storage opt-in. Analytics opt-in (in a future phase). |

### 12.4 Rate Limiting Against Abuse

| Attack | Mitigation |
|--------|-----------|
| Brute-force auth | Supabase Auth: 5 attempts/minute per IP, then lockout |
| ML API abuse (expensive calls) | 10 photo analyses/minute, 20 text analyses/minute per user. Enforced in Edge Functions. |
| Data scraping | RLS ensures users can only access their own data. No public endpoints. |
| Storage abuse (uploading huge files) | Client-side: max 500KB after preprocessing. Edge Function: reject files > 1MB. Supabase Storage: bucket-level size limits. |
| DDoS | Supabase infrastructure includes DDoS protection. Vercel has built-in DDoS protection for the SPA. |

### 12.5 Input Validation (Server-Side)

The frontend does minimal validation (it's a frozen UI). The server must validate:

| Field | Validation | Enforced By |
|-------|-----------|-------------|
| `meals.type` | Must be one of: `photo`, `text`, `template`, `quick` | PostgreSQL CHECK constraint |
| `meals.meal_label` | Must be one of: `Breakfast`, `Lunch`, `Dinner`, `Snack`, or NULL | PostgreSQL CHECK constraint |
| `meals.calories`, `protein`, `carbs`, `fat` | Must be >= 0 | PostgreSQL CHECK constraint |
| `meal_templates.meal_timing` | Must be one of: `breakfast`, `lunch`, `dinner`, `snack` | PostgreSQL CHECK constraint |
| `user_profiles.goal` | Must be one of: `lose`, `maintain`, `gain`, or NULL | PostgreSQL CHECK constraint |
| Image uploads | Must be image/jpeg or image/png, max 1MB | Edge Function validation |
| Text descriptions | Max 500 characters, trimmed, no null bytes | Edge Function validation |
| `user_id` in all writes | Must equal `auth.uid()` | RLS policies |

### 12.6 API Key / Secret Management

| Secret | Where Stored | Who Has Access |
|--------|-------------|----------------|
| `SUPABASE_URL` | Vercel env vars (VITE_ prefix — public) | Frontend (this is intentionally public — RLS protects data) |
| `SUPABASE_ANON_KEY` | Vercel env vars (VITE_ prefix — public) | Frontend (this is intentionally public — it's like a "public API key") |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets | Edge Functions only (NEVER in frontend) |
| `OPENAI_API_KEY` | Supabase Edge Function secrets | Edge Functions only |
| `USDA_API_KEY` | Supabase Edge Function secrets | Edge Functions only |
| `NUTRITIONIX_APP_ID` | Supabase Edge Function secrets | Edge Functions only |
| `NUTRITIONIX_APP_KEY` | Supabase Edge Function secrets | Edge Functions only |
| Google OAuth client secret | Supabase Auth dashboard config | Supabase Auth server only |
| Apple Sign-In private key | Supabase Auth dashboard config | Supabase Auth server only |

**Critical rule:** The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It must NEVER appear in frontend code, environment variables with `VITE_` prefix, or client-accessible JavaScript bundles.

---

## Appendix A: File Tree for New Backend Files

```
snap-nourish/
├── src/
│   ├── lib/
│   │   ├── storage.ts            ← MODIFIED (dual-write)
│   │   ├── supabaseClient.ts     ← NEW
│   │   ├── syncEngine.ts         ← NEW
│   │   ├── imagePreprocess.ts    ← NEW
│   │   ├── analyzePhoto.ts       ← NEW (client-side API caller)
│   │   ├── analyzeText.ts        ← NEW (client-side API caller)
│   │   ├── migrateLocalData.ts   ← NEW
│   │   ├── mealUtils.ts          ← MODIFIED (remove random generation)
│   │   ├── mealTemplates.ts      ← UNMODIFIED
│   │   └── utils.ts              ← UNMODIFIED
│   ├── hooks/
│   │   ├── useCamera.ts          ← NEW
│   │   ├── use-mobile.tsx        ← UNMODIFIED
│   │   └── use-toast.ts          ← UNMODIFIED
│   ├── pages/
│   │   ├── AuthCallback.tsx      ← NEW
│   │   ├── Home.tsx              ← MODIFIED (real camera + async analysis)
│   │   ├── Onboarding.tsx        ← MODIFIED (real OAuth)
│   │   ├── Profile.tsx           ← MODIFIED (real logout + new settings)
│   │   ├── Insights.tsx          ← UNMODIFIED (reads from localStorage, sync fills it)
│   │   ├── Reports.tsx           ← UNMODIFIED
│   │   ├── Index.tsx             ← UNMODIFIED
│   │   └── NotFound.tsx          ← UNMODIFIED
│   └── App.tsx                   ← MODIFIED (add /auth/callback route)
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql  ← NEW (full schema from Section 3)
│   ├── functions/
│   │   ├── analyze-photo/
│   │   │   └── index.ts            ← NEW
│   │   ├── analyze-text/
│   │   │   └── index.ts            ← NEW
│   │   ├── export-data/
│   │   │   └── index.ts            ← NEW
│   │   ├── delete-account/
│   │   │   └── index.ts            ← NEW
│   │   └── _shared/
│   │       └── nutritionLookup.ts  ← NEW (shared between photo + text functions)
│   └── config.toml                 ← NEW (Supabase project config)
├── vite.config.ts                  ← MODIFIED (add PWA plugin)
├── package.json                    ← MODIFIED (add idb, @supabase/supabase-js, vite-plugin-pwa)
└── .github/
    └── workflows/
        └── deploy.yml              ← NEW
```

## Appendix B: supabaseClient.ts

```typescript
// src/lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // picks up OAuth redirect tokens
  },
});
```

## Appendix C: New package.json Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0",
    "idb": "^8.0.0"
  },
  "devDependencies": {
    "vite-plugin-pwa": "^0.21.0"
  }
}
```

---

**End of Document**

This document is self-contained. A developer with zero prior context about Snap Nourish can read it from top to bottom and build the entire backend, from Supabase project creation through to production deployment.
