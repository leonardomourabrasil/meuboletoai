-- Add barcode field to bills table
ALTER TABLE public.bills 
ADD COLUMN barcode TEXT;