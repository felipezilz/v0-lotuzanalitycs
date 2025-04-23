-- Script para testar a inserção de um produto diretamente no banco de dados
-- Isso pode ser útil para verificar se há problemas com a estrutura do banco

-- Primeiro, vamos verificar se o usuário tem permissão para inserir
SELECT auth.uid() as current_user_id;

-- Inserir um produto de teste (substitua o user_id pelo ID retornado acima)
INSERT INTO products (name, image, user_id, created_at, updated_at)
VALUES (
  'Produto de Teste',
  '/placeholder.svg?height=200&width=200',
  auth.uid(),
  now(),
  now()
)
RETURNING *;
