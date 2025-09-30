/**
 * Serviço de Telemetria (Stub)
 * 
 * Este é um serviço "fake" que simula o rastreamento de eventos.
 * Atualmente, ele apenas imprime os eventos no console para fins de desenvolvimento.
 */

export const track = (eventName: string, properties?: Record<string, any>) => {
  console.log(`[TELEMETRY] Event: ${eventName}`, properties || "");
};
