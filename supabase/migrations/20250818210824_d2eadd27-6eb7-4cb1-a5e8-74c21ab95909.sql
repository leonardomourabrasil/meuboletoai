-- Configurar realtime para a tabela bills
ALTER TABLE public.bills REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação do realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;