-- Criar bucket para mídia de disparos
INSERT INTO storage.buckets (id, name, public)
VALUES ('dispatch-media', 'dispatch-media', true);

-- RLS para upload de mídia (usuários autenticados)
CREATE POLICY "Users can upload dispatch media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dispatch-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS para leitura pública (para UAZAPI acessar)
CREATE POLICY "Public read access for dispatch media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'dispatch-media');

-- RLS para usuários deletarem suas próprias mídias
CREATE POLICY "Users can delete their own dispatch media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'dispatch-media' AND auth.uid()::text = (storage.foldername(name))[1]);