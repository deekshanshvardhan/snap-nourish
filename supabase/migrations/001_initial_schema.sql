-- ============================================================================
-- Snap Nourish Database Schema
-- Target: Supabase PostgreSQL 15
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";


-- ============================================================================
-- TABLE: meals
-- ============================================================================

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
  client_id     UUID,
  version       INTEGER     NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_meals_user_timestamp
  ON meals (user_id, timestamp DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_meals_user_updated
  ON meals (user_id, updated_at);

CREATE UNIQUE INDEX idx_meals_user_client_id
  ON meals (user_id, client_id)
  WHERE client_id IS NOT NULL;


-- ============================================================================
-- TABLE: meal_templates
-- ============================================================================

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
  client_id     TEXT,
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
-- ============================================================================

CREATE TABLE user_profiles (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT,
  height          TEXT,
  weight          TEXT,
  age             TEXT,
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
-- ============================================================================

CREATE TABLE user_preferences (
  user_id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme                       TEXT DEFAULT 'system',
  onboarded                   BOOLEAN DEFAULT FALSE,
  personalization_completed   BOOLEAN DEFAULT FALSE,
  personalization_dismissed   BOOLEAN DEFAULT FALSE,
  show_first_hint             BOOLEAN DEFAULT TRUE,
  template_prompts_dismissed  TEXT[] DEFAULT '{}',
  photo_storage_opt_in        BOOLEAN DEFAULT TRUE,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- TABLE: pinned_meals
-- ============================================================================

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
-- ============================================================================

CREATE TABLE photo_analyses (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id         UUID        REFERENCES meals(id) ON DELETE SET NULL,
  storage_path    TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  raw_response    JSONB,
  parsed_items    JSONB,
  confidence      REAL,
  model_used      TEXT,
  processing_ms   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_photo_analyses_user ON photo_analyses (user_id, created_at DESC);
CREATE INDEX idx_photo_analyses_status ON photo_analyses (status) WHERE status = 'pending';


-- ============================================================================
-- TABLE: nutrition_cache
-- ============================================================================

CREATE TABLE nutrition_cache (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  food_name         TEXT        NOT NULL,
  normalized_name   TEXT        NOT NULL,
  source            TEXT        NOT NULL CHECK (source IN ('usda', 'nutritionix', 'openfoodfacts', 'llm_estimate')),
  source_id         TEXT,
  calories_per_100g REAL        NOT NULL,
  protein_per_100g  REAL        NOT NULL,
  carbs_per_100g    REAL        NOT NULL,
  fat_per_100g      REAL        NOT NULL,
  fiber_per_100g    REAL,
  common_serving    JSONB,
  region            TEXT,
  verified          BOOLEAN     DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nutrition_normalized ON nutrition_cache (normalized_name);
CREATE INDEX idx_nutrition_source ON nutrition_cache (source, source_id);

CREATE UNIQUE INDEX idx_nutrition_unique_source
  ON nutrition_cache (normalized_name, source)
  WHERE source_id IS NOT NULL;


-- ============================================================================
-- TABLE: sync_checkpoints
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

CREATE POLICY "Users can select own meals"
  ON meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meals"
  ON meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meals"
  ON meals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meals"
  ON meals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can select own templates"
  ON meal_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own templates"
  ON meal_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates"
  ON meal_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates"
  ON meal_templates FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users access own profile"
  ON user_profiles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own preferences"
  ON user_preferences FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own pins"
  ON pinned_meals FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own analyses"
  ON photo_analyses FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own checkpoints"
  ON sync_checkpoints FOR ALL USING (auth.uid() = user_id);

ALTER TABLE nutrition_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read nutrition cache"
  ON nutrition_cache FOR SELECT USING (true);


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

SELECT cron.schedule(
  'cleanup-expired-photos',
  '0 * * * *',
  $$DELETE FROM photo_analyses WHERE expires_at < NOW() AND status != 'processing'$$
);

SELECT cron.schedule(
  'cleanup-soft-deleted-meals',
  '0 3 * * *',
  $$DELETE FROM meals WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'$$
);

SELECT cron.schedule(
  'cleanup-soft-deleted-templates',
  '0 3 * * *',
  $$DELETE FROM meal_templates WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'$$
);


-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

CREATE POLICY "Users upload own temp photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'meal-photos-temp'
    AND (storage.foldername(name))[1] = 'temp'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Users read own temp photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'meal-photos-temp'
    AND (storage.foldername(name))[1] = 'temp'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
