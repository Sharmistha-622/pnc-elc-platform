-- Migration: Add exit_date to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS exit_date date;
