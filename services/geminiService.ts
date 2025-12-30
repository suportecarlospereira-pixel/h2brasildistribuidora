// NOME DO ARQUIVO: services/geminiService.ts
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DeliveryLocation, DriverState } from '../types';

// --- SEGURANÇA E CONFIGURAÇÃO ---
const getAIClient = () => {
  const apiKey = process.env.API_KEY; 
  if (!apiKey || apiKey.includes("PLACEHOLDER") || apiKey === "undefined") {
    console.warn("IA Offline: Chave de API inválida ou não configurada.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// HELPER: Limpa formatações Markdown (```json) que a IA envia frequentemente
const cleanGeminiJSON = (text: string): string => {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- FUNÇÕES ---

export const optimizeRouteOrder = async (
  startPoint: { lat: number, lng: number },
  destinations: DeliveryLocation[]
): Promise<string[]> => {
  const ai = getAIClient();
  // Se a IA não estiver disponível ou só tiver 1 destino, não precisa otimizar
  if (!ai || destinations.length <= 1) return destinations.map(d => d.id);
  
  const destList = destinations.map(d => `- ID: ${d.id}, Endereço: ${d.address}, Coords: ${d.coords.lat},${d.coords.lng}`).join('\n');

  const prompt = `
    Atue como especialista logístico em Itajaí, SC.
    Origem GPS: ${startPoint.lat}, ${startPoint.lng}.
    Destinos:
    ${destList}
    
    TAREFA: Ordene os IDs para a rota mais rápida considerando o trânsito urbano.
    REGRAS:
    1. Otimize para evitar retorno em avenidas principais.
    2. Retorne APENAS um Array JSON puro com os IDs na ordem (ex: ["id1", "id2"]).
    3. NÃO escreva explicações, apenas o JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const rawText = response.text || "[]";
    const cleanedJson = cleanGeminiJSON(rawText);
    
    return JSON.parse(cleanedJson) as string[];
  } catch (error) {
    console.error("Erro IA Otimização:", error);
    // Fallback: Retorna a ordem original se a IA falhar
    return destinations.map(d => d.id);
  }
};

export const getRouteBriefingAudio = async (driverName: string, route: DeliveryLocation[]): Promise<string | null> => {
  const ai = getAIClient();
  if (!ai || route.length === 0) return null;

  // Simplifica o texto para o áudio ficar natural
  const stops = route.slice(0, 5).map((l, i) => `${i + 1}: ${l.name.split('-')[0]}`).join('. ');
  const more = route.length > 5 ? `e mais ${route.length - 5} locais.` : '';
  
  const prompt = `
    Fale como um operador de rádio amigável e profissional.
    Texto: "Olá ${driverName}. Rota carregada com ${route.length} entregas. Sequência inicial: ${stops} ${more}. Bom trabalho e atenção no trânsito."
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", 
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) {
    console.error("Erro IA Audio:", e);
    return null;
  }
};

export const getSmartAssistantResponse = async (query: string): Promise<string> => {
  const ai = getAIClient();
  if (!ai) return "Sistema de IA offline. Verifique a chave de API.";

  try {
     const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Você é o assistente da Logística H2 Brasil. Responda de forma curta e executiva (max 2 frases): ${query}`,
    });
    return response.text || "Sem resposta.";
  } catch (e) {
    return "Erro de conexão com a IA.";
  }
}

export const distributeAndOptimizeRoutes = async (
  drivers: DriverState[],
  destinations: DeliveryLocation[]
): Promise<Record<string, string[]>> => {
    const ai = getAIClient();
    if (!ai) return {};

    // Lógica simplificada de fallback (se a IA não carregar, não distribui nada para evitar erros)
    // Em produção real, você usaria o mesmo padrão do optimizeRouteOrder
    return {}; 
};
