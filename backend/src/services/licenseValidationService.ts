interface ValidatedLicense {
  isValid: boolean;
  entitlement: string;
  userId: string | null;
}

/**
 * Valida um token de licença do Office.
 *
 * ATENÇÃO: Esta é uma simulação para desenvolvimento.
 * Em um ambiente de produção, esta função deve:
 * 1. Chamar o endpoint de validação de licenças da Microsoft com o token.
 * 2. Retornar os dados da licença com base na resposta da Microsoft.
 *
 * @param token O token de licença a ser validado.
 * @returns {Promise<ValidatedLicense>} Os detalhes da licença validada.
 */
export const validateLicenseToken = async (token: string): Promise<ValidatedLicense> => {
  console.log(`[LICENSE-VALIDATION-SIM] Validando o token: ${token}`);

  // Simula a validação do token
  if (token === "FAKE_FREE_LICENSE_TOKEN") {
    return {
      isValid: true,
      entitlement: "Free",
      userId: "dev-user-free-456",
    };
  }

  if (token === "FAKE_PAID_LICENSE_TOKEN") {
    return {
      isValid: true,
      entitlement: "Paid",
      userId: "dev-user-paid-789",
    };
  }
  
  // Em produção, qualquer token que não seja validado pela Microsoft cairia aqui.
  return {
    isValid: false,
    entitlement: "Invalid",
    userId: null,
  };
};
