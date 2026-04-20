ALTER TABLE public.proposals
ADD COLUMN IF NOT EXISTS camaras jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.proposals.camaras IS 'Lista estruturada de câmaras: [{ identificador, dimensoes:{c,l,a,unidade}, volume_m3, temperatura_c, produto, isolamento, espessura_mm, carga_termica_kcal_h, qtd_camaras_iguais, equipamentos:[{ modelo, marca, quantidade, capacidade_unitaria_kcal_h, gas, compressor }] }]';