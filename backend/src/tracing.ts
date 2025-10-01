import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Configura o SDK do OpenTelemetry
const sdk = new NodeSDK({
  // Para desenvolvimento, vamos exportar os traces para o console.
  // Em produção, você trocaria isso por um exportador para um serviço como Jaeger, Datadog, etc.
  traceExporter: new ConsoleSpanExporter(),
  
  // Instrumentações automáticas para bibliotecas populares (Express, http, etc.)
  instrumentations: [getNodeAutoInstrumentations()],
  
  // Define o nome do serviço que aparecerá nos traces
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'wing-backend',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
});

// Inicia o SDK e o processo de tracing
sdk.start();

// Garante que o SDK seja desligado corretamente ao fechar a aplicação
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing-SDK desligado com sucesso.'))
    .catch((error) => console.log('Erro ao desligar o Tracing-SDK:', error))
    .finally(() => process.exit(0));
});
