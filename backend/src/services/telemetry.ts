import logger from './logger.ts';

/**
 * Serviço de Telemetria (Stub)
 * 
 * Este é um serviço "fake" que simula o rastreamento de eventos.
 * Atualmente, ele apenas imprime os eventos no console para fins de desenvolvimento.
 */

export const track = (eventName: string, properties?: Record<string, any>) => {
  logger.info({ event: eventName, ...properties }, `Telemetry event: ${eventName}`);
};
