-- Adicionar novos campos à tabela product_data
ALTER TABLE product_data 
ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ctr DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cpc DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cpm DECIMAL DEFAULT 0;

-- Atualizar a função de cálculo para incluir os novos campos
CREATE OR REPLACE FUNCTION calculate_product_data_fields()
RETURNS TRIGGER AS $
BEGIN
  -- Calcular lucro (profit)
  NEW.profit := NEW.revenue - NEW.investment;
  
  -- Calcular ROI
  IF NEW.investment > 0 THEN
    NEW.roi := (NEW.profit / NEW.investment) * 100;
  ELSE
    NEW.roi := 0;
  END IF;
  
  -- Calcular CPA
  IF NEW.visits > 0 THEN
    NEW.cpa := NEW.investment / NEW.visits;
  ELSE
    NEW.cpa := 0;
  END IF;
  
  -- Calcular CTR
  IF NEW.impressions > 0 THEN
    NEW.ctr := (NEW.clicks::DECIMAL / NEW.impressions) * 100;
  ELSE
    NEW.ctr := 0;
  END IF;
  
  -- Calcular CPC
  IF NEW.clicks > 0 THEN
    NEW.cpc := NEW.investment / NEW.clicks;
  ELSE
    NEW.cpc := 0;
  END IF;
  
  -- Calcular CPM
  IF NEW.impressions > 0 THEN
    NEW.cpm := (NEW.investment / NEW.impressions) * 1000;
  ELSE
    NEW.cpm := 0;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;
