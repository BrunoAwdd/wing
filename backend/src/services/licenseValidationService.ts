import { supabase } from "./supabaseClient.ts";

interface ValidatedLicense {
  isValid: boolean;
  entitlement: string; // Mapeado de 'scopes'
  userId: string | null;
}

// Helper para converter string para ArrayBuffer para hashing
function str2ab(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

/**
 * Valida uma chave de API usando o banco de dados Supabase.
 *
 * @param token A chave de API completa (ex: 'wing_dev_...') a ser validada.
 * @returns {Promise<ValidatedLicense>} Os detalhes da licença/chave validada.
 */
export const validateLicenseToken = async (token: string): Promise<ValidatedLicense> => {
  console.log(`[LICENSE-VALIDATION] Validando o token via Supabase...`);

  const tokenParts = token.split('_');
  if (tokenParts.length < 2) {
    console.error("[LICENSE-VALIDATION] Formato de token inválido.");
    return { isValid: false, entitlement: "Invalid", userId: null };
  }

  const keyPrefix = tokenParts[0];

  // 1. Busca a chave pelo prefixo
  const { data: apiKeyData, error: apiKeyError } = await supabase
    .from('api_keys')
    .select('id, user_id, key_hash, scopes, status, quota_monthly')
    .eq('key_prefix', keyPrefix)
    .single();

  if (apiKeyError || !apiKeyData) {
    console.error("[LICENSE-VALIDATION] Chave de API não encontrada ou erro:", apiKeyError?.message);
    return { isValid: false, entitlement: "Invalid", userId: null };
  }

  // 2. Compara o hash da chave completa
  // ATENÇÃO: Assumindo que o hash no banco é SHA-256 da chave completa.
  const tokenHashBuffer = await crypto.subtle.digest('SHA-256', str2ab(token));
  const tokenHash = new Uint8Array(tokenHashBuffer);
  
  // O Supabase retorna o `bytea` como uma string de escape do PostgreSQL (ex: '\x...').
  // Precisamos converter essa string para um Uint8Array para comparar.
  const dbHashString = (apiKeyData.key_hash as unknown as string).substring(2); // Remove '\x'
  const dbHash = new Uint8Array(dbHashString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  if (tokenHash.length !== dbHash.length) {
    console.error("[LICENSE-VALIDATION] Incompatibilidade no tamanho do hash.");
    return { isValid: false, entitlement: "Invalid", userId: null };
  }

  let isEqual = true;
  for (let i = 0; i < tokenHash.length; i++) {
    if (tokenHash[i] !== dbHash[i]) {
      isEqual = false;
      break;
    }
  }

  if (!isEqual) {
    console.error("[LICENSE-VALIDATION] Hash da chave não corresponde.");
    return { isValid: false, entitlement: "Invalid", userId: null };
  }

  // 3. Verifica o status da chave
  if (apiKeyData.status !== 'active') {
    console.warn(`[LICENSE-VALIDATION] Chave de API ${apiKeyData.id} não está ativa.`);
    return { isValid: false, entitlement: "Inactive", userId: apiKeyData.user_id };
  }

  // TODO: Adicionar verificação de cota (quota_monthly) e uso (usage_rollup)

  // 4. Atualiza o último uso (sem aguardar, para não atrasar a resposta)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKeyData.id)
    .then(({ error }) => {
      if (error) console.error("[USAGE-UPDATE] Erro ao atualizar last_used_at:", error.message);
    });

  // TODO: Adicionar lógica de upsert para a tabela usage_rollup

  console.log(`[LICENSE-VALIDATION] Token validado com sucesso para o usuário ${apiKeyData.user_id}.`);

  // Mapeia os scopes para um único entitlement. Simplificação.
  const entitlement = (apiKeyData.scopes as string[]).includes('rewrite') ? "Paid" : "Free";

  return {
    isValid: true,
    entitlement: entitlement, 
    userId: apiKeyData.user_id,
  };
};