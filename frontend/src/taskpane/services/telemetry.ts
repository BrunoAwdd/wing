/**
 * Serviço de Telemetria (Stub)
 * 
 * Este é um serviço "fake" que simula o rastreamento de eventos.
 * Atualmente, ele apenas imprime os eventos no console para fins de desenvolvimento.
 * 
 * Para uma implementação real, substitua o conteúdo da função `track` pela lógica
 * de integração do serviço de telemetria escolhido (ex: Amplitude, PostHog).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const track = (eventName: string, properties?: Record<string, any>) => {
  console.log(`[TELEMETRY] Event: ${eventName}`, properties || "");

  // Lógica de produção seria algo como:
  // if (process.env.NODE_ENV === 'production') {
  //   amplitude.getInstance().logEvent(eventName, properties);
  // }
};
