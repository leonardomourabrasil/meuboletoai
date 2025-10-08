
// Serviço de compatibilidade - agora usa o novo sistema de provedores de IA
import { analyzeBillWithProvider, getAISettings, type BillAnalysisResult, type AIProvider } from './ai-providers';

export { type BillAnalysisResult };

// Função principal - mantém compatibilidade com código existente
export const analyzeBillWithAI = async (file: File, apiKey: string): Promise<BillAnalysisResult> => {
  console.log('OCR Service: Iniciando análise com novo sistema de provedores');
  
  let { provider } = getAISettings();

  // Heurística: se a API key indicar claramente o provedor, forçar override
  const key = (apiKey || '').trim();
  const detectProviderFromKey = (k: string): AIProvider | null => {
    if (k.startsWith('sk-')) return 'openai'; // OpenAI
    if (k.startsWith('AIza')) return 'gemini'; // Google API keys
    if (k.startsWith('sk-ant-') || k.toLowerCase().includes('anthropic')) return 'claude';
    return null;
  };
  const detected = detectProviderFromKey(key);
  if (detected && detected !== provider) {
    console.log('OCR Service: Provider override via API key ->', detected, '(antes:', provider, ')');
    provider = detected;
  }
  console.log('OCR Service: Provider ativo para análise =', provider);
  
  return await analyzeBillWithProvider(file, apiKey, provider);
};

// Função para obter chave da API - atualizada com suporte por usuário
export const getApiKey = (): string | null => {
  const { apiKey } = getAISettings();
  return apiKey;
};
