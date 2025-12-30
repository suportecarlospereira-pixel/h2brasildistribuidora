// NOME DO ARQUIVO: services/geminiService.ts
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DeliveryLocation, DriverState } from '../types';

// --- SEGURANÇA ---
// Função auxiliar para pegar o cliente apenas quando necessário
const getAIClient = () => {
  // Tenta pegar a chave injetada pelo Vite
  const apiKey = process.env.API_KEY; 
  
  // Se a chave não existir ou for o placeholder, retorna nulo e não trava o app
  if (!apiKey || apiKey.includes("PLACEHOLDER") || apiKey === "undefined") {
    console.warn("IA Offline: Chave de API inválida ou não configurada.");
    return null;
  }
  
  return new GoogleGenAI({ apiKey });
};

// --- FUNÇÕES ---

export const optimizeRouteOrder = async (
  startPoint: { lat: number, lng: number },
  destinations: DeliveryLocation[]
): Promise<string[]> => {
  const ai = getAIClient();
  // Se a IA não estiver disponível, retorna a rota original sem travar
  if (!ai || destinations.length === 0) return destinations.map(d => d.id);
  
  const destList = destinations.map(d => `- ID: ${d.id}, Nome: ${d.name}, Endereço: ${d.address}, Lat: ${d.coords.lat}, Lng: ${d.coords.lng}`).join('\n');

  const prompt = `
    Atue como especialista logístico em Itajaí, SC.
    Origem: Lat: ${startPoint.lat}, Lng: ${startPoint.lng}.
    Destinos:
    ${destList}
    Ordene os IDs para otimizar tempo. Retorne APENAS array JSON de strings.
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

    const jsonStr = response.text?.trim();
    if (jsonStr) return JSON.parse(jsonStr) as string[];
    return destinations.map(d => d.id);
  } catch (error) {
    console.error("Erro IA:", error);
    return destinations.map(d => d.id);
  }
};

export const getRouteBriefingAudio = async (driverName: string, route: DeliveryLocation[]): Promise<string | null> => {
  const ai = getAIClient();
  if (!ai || route.length === 0) return null;

  const stops = route.map((l, i) => `${i + 1}ª: ${l.name}`).join('. ');
  const prompt = `Fale curto e motivador: Olá ${driverName}. Rota pronta com ${route.length} paradas: ${stops}. Bom trabalho!`;

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
    return null;
  }
};

export const getSmartAssistantResponse = async (query: string): Promise<string> => {
  const ai = getAIClient();
  if (!ai) return "Sistema de IA offline. Verifique a chave de API.";

  try {
     const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Você é a IA da H2 Brasil. Responda: ${query}`,
    });
    return response.text || "Sem resposta.";
  } catch (e) {
    return "Erro ao contatar IA.";
  }
}

export const distributeAndOptimizeRoutes = async (
  drivers: DriverState[],
  destinations: DeliveryLocation[]
): Promise<Record<string, string[]>> => {
    const ai = getAIClient();
    if (!ai) return {};

    // Lógica simplificada para evitar erro de tipo se IA falhar
    return {}; 
};