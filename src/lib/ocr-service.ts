
// Serviço de compatibilidade - agora usa o novo sistema de provedores de IA
import { analyzeBillWithProvider, getAISettings, type BillAnalysisResult } from './ai-providers';

export { type BillAnalysisResult };

// Função principal - mantém compatibilidade com código existente
export const analyzeBillWithAI = async (file: File, apiKey: string): Promise<BillAnalysisResult> => {
  console.log('OCR Service: Iniciando análise com novo sistema de provedores');
  
  const { provider } = getAISettings();
  
  return await analyzeBillWithProvider(file, apiKey, provider);
};

// Função para obter chave da API - atualizada com suporte por usuário
export const getApiKey = (): string | null => {
  const { apiKey } = getAISettings();
  return apiKey;
};
