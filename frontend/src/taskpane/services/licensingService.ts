/* global Office, process */

/**
 * Obtém o token de licença do Office.
 *
 * ATENÇÃO: Esta é uma simulação para desenvolvimento.
 * Em um ambiente de produção, `(Office.context as any).commerce.getLicense()`
 * retornaria um token real assinado pela Microsoft.
 *
 * Por enquanto, estamos simulando um token para um usuário "Free".
 *
 * @returns {Promise<string>} O token da licença.
 */
export const getLicenseToken = async (): Promise<string> => {
  if (process.env.NODE_ENV !== 'production') {
    console.log("[LICENSE-SIM] Retornando um TOKEN de licença 'Free' simulado.");
    // Em um cenário real, este seria um JWT longo. Para a simulação, uma string simples é suficiente.
    // O importante é que o backend saiba como interpretar este token de teste.
    return "FAKE_FREE_LICENSE_TOKEN";
  }

  try {
    // O `as any` ainda é necessário se o tsconfig não estiver 100% correto.
    const token = await (Office.context as any).commerce.getLicense();
    return token;
  } catch (error) {
    console.error("Erro ao obter token de licença real:", error);
    return "ERROR_FETCHING_TOKEN";
  }
};
