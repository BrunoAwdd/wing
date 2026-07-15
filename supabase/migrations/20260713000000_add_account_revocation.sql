-- M3: revogação administrativa é diferente de cancelamento da assinatura.
-- Uma assinatura cancelada volta ao plano Free; uma conta revogada não pode
-- iniciar nem continuar conversas, independentemente do plano ou da cota.
alter table accounts
  add column if not exists revoked_at timestamptz;
