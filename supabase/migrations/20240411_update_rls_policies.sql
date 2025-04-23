-- Atualiza a política para profiles para permitir inserções pelo trigger
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios perfis" ON profiles;
CREATE POLICY "Usuários podem inserir seus próprios perfis"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id OR (SELECT current_setting('role') = 'service_role'));

-- Atualiza a política para permitir que o trigger insira perfis
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
