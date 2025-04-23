-- Este script otimiza as políticas RLS para melhorar o desempenho
-- Substitui chamadas diretas a auth.uid() por subconsultas (SELECT auth.uid())
-- para evitar reavaliações desnecessárias para cada linha

-- ==========================================
-- Otimização para a tabela profiles
-- ==========================================

-- 1. Política: Usuários podem ver apenas seus próprios perfis
DROP POLICY IF EXISTS "Usuários podem ver apenas seus próprios perfis" ON profiles;
CREATE POLICY "Usuários podem ver apenas seus próprios perfis" 
ON profiles FOR SELECT
USING (id = (SELECT auth.uid()));

-- 2. Política: Usuários podem atualizar apenas seus próprios perfis
DROP POLICY IF EXISTS "Usuários podem atualizar apenas seus próprios perfis" ON profiles;
CREATE POLICY "Usuários podem atualizar apenas seus próprios perfis" 
ON profiles FOR UPDATE
USING (id = (SELECT auth.uid()));

-- 3. Política: Usuários podem inserir seus próprios perfis
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios perfis" ON profiles;
CREATE POLICY "Usuários podem inserir seus próprios perfis"
ON profiles FOR INSERT
WITH CHECK (id = (SELECT auth.uid()) OR (SELECT current_setting('role') = 'service_role'));

-- ==========================================
-- Otimização para a tabela products
-- ==========================================

-- 1. Política: Usuários podem ver apenas seus próprios produtos
DROP POLICY IF EXISTS "Usuários podem ver apenas seus próprios produtos" ON products;
CREATE POLICY "Usuários podem ver apenas seus próprios produtos" 
ON products FOR SELECT
USING (user_id = (SELECT auth.uid()));

-- 2. Política: Usuários podem inserir apenas seus próprios produtos
DROP POLICY IF EXISTS "Usuários podem inserir apenas seus próprios produtos" ON products;
CREATE POLICY "Usuários podem inserir apenas seus próprios produtos" 
ON products FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()));

-- 3. Política: Usuários podem atualizar apenas seus próprios produtos
DROP POLICY IF EXISTS "Usuários podem atualizar apenas seus próprios produtos" ON products;
CREATE POLICY "Usuários podem atualizar apenas seus próprios produtos" 
ON products FOR UPDATE
USING (user_id = (SELECT auth.uid()));

-- 4. Política: Usuários podem excluir apenas seus próprios produtos
DROP POLICY IF EXISTS "Usuários podem excluir apenas seus próprios produtos" ON products;
CREATE POLICY "Usuários podem excluir apenas seus próprios produtos" 
ON products FOR DELETE
USING (user_id = (SELECT auth.uid()));

-- ==========================================
-- Otimização para a tabela product_data
-- ==========================================

-- 1. Política: Usuários podem ver apenas dados de seus próprios produtos
DROP POLICY IF EXISTS "Usuários podem ver apenas dados de seus próprios produtos" ON product_data;
CREATE POLICY "Usuários podem ver apenas dados de seus próprios produtos" 
ON product_data FOR SELECT
USING (
  product_id IN (
    SELECT id FROM products WHERE user_id = (SELECT auth.uid())
  )
);

-- 2. Política: Usuários podem inserir apenas dados para seus próprios produtos
DROP POLICY IF EXISTS "Usuários podem inserir apenas dados para seus próprios produt" ON product_data;
CREATE POLICY "Usuários podem inserir apenas dados para seus próprios produt" 
ON product_data FOR INSERT
WITH CHECK (
  product_id IN (
    SELECT id FROM products WHERE user_id = (SELECT auth.uid())
  )
);

-- 3. Política: Usuários podem atualizar apenas dados de seus próprios produtos
DROP POLICY IF EXISTS "Usuários podem atualizar apenas dados de seus próprios produt" ON product_data;
CREATE POLICY "Usuários podem atualizar apenas dados de seus próprios produt" 
ON product_data FOR UPDATE
USING (
  product_id IN (
    SELECT id FROM products WHERE user_id = (SELECT auth.uid())
  )
);

-- 4. Política: Usuários podem excluir apenas dados de seus próprios produtos
DROP POLICY IF EXISTS "Usuários podem excluir apenas dados de seus próprios produtos" ON product_data;
CREATE POLICY "Usuários podem excluir apenas dados de seus próprios produtos" 
ON product_data FOR DELETE
USING (
  product_id IN (
    SELECT id FROM products WHERE user_id = (SELECT auth.uid())
  )
);
