-- Migration V12: Add company profile fields to distributors
ALTER TABLE distributors ADD COLUMN email TEXT;
ALTER TABLE distributors ADD COLUMN phone TEXT;
ALTER TABLE distributors ADD COLUMN address TEXT;
ALTER TABLE distributors ADD COLUMN contact_person TEXT;
