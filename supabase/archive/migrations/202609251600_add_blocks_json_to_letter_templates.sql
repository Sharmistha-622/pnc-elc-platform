-- Add blocks_json column to letter_templates table for structured block-based templates
ALTER TABLE IF EXISTS letter_templates ADD COLUMN IF NOT EXISTS blocks_json JSONB;
