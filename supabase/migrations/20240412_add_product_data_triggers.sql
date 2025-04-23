-- Função para calcular campos derivados (profit, roi, cpa)
CREATE OR REPLACE FUNCTION calculate_product_data_fields()
RETURNS TRIGGER AS $$
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular campos antes de inserir
DROP TRIGGER IF EXISTS before_product_data_insert ON product_data;
CREATE TRIGGER before_product_data_insert
  BEFORE INSERT ON product_data
  FOR EACH ROW
  EXECUTE FUNCTION calculate_product_data_fields();

-- Trigger para calcular campos antes de atualizar
DROP TRIGGER IF EXISTS before_product_data_update ON product_data;
CREATE TRIGGER before_product_data_update
  BEFORE UPDATE ON product_data
  FOR EACH ROW
  EXECUTE FUNCTION calculate_product_data_fields();
