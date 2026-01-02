-- SQLite Database Schema for Tex Intel Call Logging
-- This schema is designed to be migration-friendly to PostgreSQL

-- ====================
-- CALLS TABLE
-- Core call metadata
-- ====================
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,  -- VAPI call ID
  client_id TEXT NOT NULL DEFAULT 'tex-intel-primary',

  -- Call metadata
  phone_number_id TEXT,  -- VAPI phone number ID
  caller_phone TEXT,
  call_type TEXT CHECK(call_type IN ('inboundPhoneCall', 'outboundPhoneCall', 'webCall')),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,

  -- Status
  status TEXT CHECK(status IN ('queued', 'ringing', 'in-progress', 'forwarding', 'ended')),
  ended_reason TEXT,

  -- Content
  transcript TEXT,
  summary TEXT,
  recording_url TEXT,
  stereo_recording_url TEXT,

  -- Analytics
  success_score INTEGER CHECK(success_score >= 1 AND success_score <= 10),

  -- Cost
  cost_total REAL,
  cost_transport REAL,
  cost_stt REAL,
  cost_llm REAL,
  cost_tts REAL,
  cost_vapi REAL,
  llm_prompt_tokens INTEGER,
  llm_completion_tokens INTEGER,
  tts_characters INTEGER,

  -- Timestamps for tracking
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- STRUCTURED DATA TABLE
-- Extracted fields per call
-- ====================
CREATE TABLE IF NOT EXISTS call_structured_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL UNIQUE,

  -- Caller information
  caller_name TEXT,
  caller_company TEXT,
  caller_phone TEXT,
  caller_email TEXT,

  -- Intent
  intent_category TEXT CHECK(intent_category IN ('sales', 'rental', 'parts', 'service', 'billing', 'general', 'other')),
  intent_subcategory TEXT,

  -- Machine details
  machine_make TEXT,
  machine_model TEXT,
  machine_year INTEGER,
  machine_serial TEXT,
  machine_category TEXT,

  -- Call details
  location TEXT,
  timing TEXT,
  urgency TEXT CHECK(urgency IN ('low', 'medium', 'high', 'critical')),

  -- Outcome
  outcome_type TEXT CHECK(outcome_type IN ('transferred', 'callback_scheduled', 'voicemail', 'wrong_number', 'not_interested', 'information_provided', 'other')),
  outcome_transferred_to TEXT CHECK(outcome_transferred_to IN ('sales', 'service', 'parts') OR outcome_transferred_to IS NULL),
  outcome_next_step TEXT,
  outcome_scheduled_callback_time TEXT,

  -- Additional notes
  notes TEXT,

  -- Raw JSON for reference
  raw_json TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
);

-- ====================
-- CONTACTS TABLE
-- Known callers and their history
-- ====================
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT UNIQUE NOT NULL,

  name TEXT,
  company TEXT,
  email TEXT,

  -- Metadata
  status TEXT CHECK(status IN ('VIP', 'New', 'Bad Standing', 'Regular')) DEFAULT 'New',
  last_machine TEXT,  -- Last machine they inquired about

  -- Stats
  total_calls INTEGER DEFAULT 0,
  last_call_at TIMESTAMP,
  first_call_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- INVENTORY TABLE
-- Equipment rental inventory
-- ====================
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  category TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 0,
  price_per_day REAL NOT NULL,

  -- Equipment details
  condition TEXT CHECK(condition IN ('Excellent', 'Good', 'Fair', 'Poor')),
  year INTEGER,
  specs TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- CLIENTS TABLE (for multi-client support)
-- ====================
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,

  -- Transfer destinations
  sales_phone TEXT,
  service_phone TEXT,
  parts_phone TEXT,
  rentals_phone TEXT,
  billing_phone TEXT,

  -- VAPI Configuration (Pre-created Assistant Architecture)
  vapi_assistant_id TEXT,  -- The pre-created assistant ID in VAPI
  custom_prompt TEXT,  -- Client-specific system prompt additions
  first_message_template TEXT,  -- Template for first message (supports variables)

  -- Tool enablement flags
  enable_inventory INTEGER DEFAULT 1,  -- SQLite uses INTEGER for boolean
  enable_transfers INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================
-- CLIENT PHONE NUMBERS
-- Maps VAPI phone numbers to clients
-- ====================
CREATE TABLE IF NOT EXISTS client_phone_numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  vapi_phone_number_id TEXT UNIQUE NOT NULL,
  phone_number TEXT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- ====================
-- INDEXES
-- ====================

-- Calls indexes
CREATE INDEX IF NOT EXISTS idx_calls_client_id ON calls(client_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_caller_phone ON calls(caller_phone);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);

-- Structured data indexes
CREATE INDEX IF NOT EXISTS idx_structured_intent_category ON call_structured_data(intent_category);
CREATE INDEX IF NOT EXISTS idx_structured_urgency ON call_structured_data(urgency);
CREATE INDEX IF NOT EXISTS idx_structured_outcome_type ON call_structured_data(outcome_type);
CREATE INDEX IF NOT EXISTS idx_structured_machine_make ON call_structured_data(machine_make);

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_last_call ON contacts(last_call_at DESC);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_available ON inventory(available);
CREATE INDEX IF NOT EXISTS idx_inventory_model ON inventory(model);

-- Client phone numbers index
CREATE INDEX IF NOT EXISTS idx_client_phones_vapi_id ON client_phone_numbers(vapi_phone_number_id);

-- ====================
-- SCHEMA MIGRATIONS
-- Note: These columns are now in the CREATE TABLE statement above
-- The ALTER TABLE statements below are only needed for existing databases
-- and will error if columns already exist (which is expected/safe to ignore)
-- ====================

-- ALTER TABLE clients ADD COLUMN vapi_assistant_id TEXT;
-- ALTER TABLE clients ADD COLUMN custom_prompt TEXT;
-- ALTER TABLE clients ADD COLUMN first_message_template TEXT;

-- ====================
-- SEED DATA
-- Default client (Tex Intel)
-- ====================
INSERT OR IGNORE INTO clients (
  id,
  name,
  company,
  sales_phone,
  service_phone,
  parts_phone,
  first_message_template,
  custom_prompt,
  enable_inventory,
  enable_transfers
)
VALUES (
  'client-portal',
  'Tex Intel',
  'Tex Intel Heavy Equipment',
  '+16025705474',
  '+16025705474',
  '+16025705474',
  'Thanks for calling Tex Intel. How can I help you?',
  NULL,  -- No custom prompt additions
  0,     -- Inventory disabled (tool exists in Vapi but not assigned to assistant)
  1      -- Transfers enabled
);

-- ====================
-- SEED CONTACTS (Customer Data)
-- ====================
INSERT OR IGNORE INTO contacts (phone_number, name, company, last_machine, status)
VALUES
  ('+16025705474', 'Abhave', 'Tex Intel HQ', 'Cat 336 Excavator', 'VIP'),
  ('+15125559999', 'Bob Builder', 'Austin Construction', 'Skid Steer', 'New'),
  ('+14695558888', 'Sarah Martinez', 'Dallas Demolition Co', 'Cat D6 Dozer', 'VIP'),
  ('+17135557777', 'Mike Johnson', 'Houston Heavy Haul', 'Dump Truck', 'New');

-- ====================
-- SEED INVENTORY (Equipment Data)
-- ====================
INSERT OR IGNORE INTO inventory (model, category, available, price_per_day, condition, year, specs)
VALUES
  ('Cat 336', 'Excavator', 2, 1200, 'Excellent', 2022, '36-ton, 268hp, 24ft dig depth'),
  ('Cat 320', 'Excavator', 3, 950, 'Good', 2021, '20-ton, 121hp, 20ft dig depth'),
  ('Cat D6', 'Dozer', 0, 900, 'Good', 2020, '160hp, 14ft blade'),
  ('Cat D8', 'Dozer', 1, 1400, 'Excellent', 2023, '305hp, 16ft blade, GPS ready'),
  ('Bobcat T76', 'Skid Steer', 5, 350, 'Good', 2021, '74hp, 3,000lb capacity'),
  ('Bobcat S650', 'Skid Steer', 4, 300, 'Fair', 2019, '74hp, 2,300lb capacity'),
  ('JCB 3CX', 'Backhoe', 2, 500, 'Good', 2020, '97hp, 4WD, extendable arm'),
  ('Cat 950M', 'Loader', 2, 850, 'Excellent', 2022, '220hp, 5-yard bucket'),
  ('Volvo A40G', 'Dump Truck', 3, 1100, 'Good', 2021, '38-ton capacity, articulated'),
  ('Manitowoc 18000', 'Crane', 1, 2500, 'Excellent', 2023, '440-ton capacity, crawler mounted'),
  ('Bobcat S570', 'Skid Steer', 3, 275, 'Good', 2020, '66hp, 2,000lb capacity'),
  ('Cat 262D', 'Skid Steer', 2, 400, 'Excellent', 2023, '90hp, 3,300lb capacity'),
  ('John Deere 332G', 'Skid Steer', 4, 380, 'Good', 2022, '100hp, 3,700lb capacity'),
  ('Kubota SSV75', 'Skid Steer', 2, 320, 'Fair', 2019, '74hp, 2,590lb capacity');

-- ====================
-- VIEWS (Optional - for easier querying)
-- ====================

-- Full call details with structured data
CREATE VIEW IF NOT EXISTS call_details AS
SELECT
  c.*,
  s.caller_name,
  s.caller_company,
  s.intent_category,
  s.intent_subcategory,
  s.machine_make,
  s.machine_model,
  s.machine_year,
  s.machine_category,
  s.urgency,
  s.outcome_type,
  s.outcome_transferred_to,
  s.outcome_next_step,
  s.notes
FROM calls c
LEFT JOIN call_structured_data s ON c.id = s.call_id;

-- Daily call statistics
CREATE VIEW IF NOT EXISTS daily_call_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN status = 'ended' THEN 1 END) as completed_calls,
  AVG(duration_seconds) as avg_duration,
  SUM(cost_total) as total_cost,
  AVG(success_score) as avg_success_score
FROM calls
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Intent breakdown
CREATE VIEW IF NOT EXISTS intent_breakdown AS
SELECT
  s.intent_category,
  COUNT(*) as count,
  AVG(c.success_score) as avg_success_score,
  AVG(c.duration_seconds) as avg_duration
FROM call_structured_data s
JOIN calls c ON s.call_id = c.id
WHERE s.intent_category IS NOT NULL
GROUP BY s.intent_category
ORDER BY count DESC;
