-- Add discount field to bills table
ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0;