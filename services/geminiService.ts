import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DeliveryLocation, DriverState } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Single Driver TSP with Traffic Awareness
export const optimizeRouteOrder = async (
  startPoint: { lat: number, lng: number },
  destinations: DeliveryLocation[]
): Promise<string[]> => {
  if (!process.env.API_KEY || destinations.length === 0) return destinations.map(d => d.id);
  
  const destList = destinations.map(d => `- ID: ${d.id}, Nome: ${d.name}, Endereço: ${d.address}, Lat: ${d.coords.lat}, Lng: ${d.coords.lng}`).join('\n');

  const prompt = `
    Atue como um especialista em logística urbana em Itajaí, SC.
    Ponto de partida atual (GPS): Lat: ${startPoint.lat}, Lng: ${startPoint.lng}.
    
    Destinos:
    ${destList}

    OBJETIVO: Ordene os IDs das entregas para minimizar o tempo total, considerando:
    1. Tráfego típico de Itajaí (regiões do Porto, Balsa e Acesso à BR-101).
    2. Proximidade geográfica (TSP).
    3. Evite cruzamentos desnecessários em avenidas principais.

    Retorne APENAS um array JSON de strings com os IDs na ordem otimizada.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
    console.error("Erro na otimização:", error);
    return destinations.map(d => d.id);
  }
};

// Route Briefing using Gemini TTS
export const getRouteBriefingAudio = async (driverName: string, route: DeliveryLocation[]): Promise<string | null> => {
  if (!process.env.API_KEY || route.length === 0) return null;

  const stops = route.map((l, i) => `${i + 1}ª parada: ${l.name} no bairro ${l.address.split('-')[1] || 'Centro'}`).join('. ');
  const prompt = `Diga de forma encorajadora e profissional: Olá ${driverName}, sua rota de hoje está pronta. Você tem ${route.length} entregas. A sequência otimizada é: ${stops}. Dirija com cuidado e atenção ao trânsito de Itajaí!`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
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
    console.error("Erro ao gerar áudio:", e);
    return null;
  }
};

export const getSmartAssistantResponse = async (query: string): Promise<string> => {
  if (!process.env.API_KEY) return "Erro de configuração.";

  try {
     const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Você é o Cérebro Logístico da H2 Brasil em Itajaí. Responda brevemente: ${query}`,
      config: { tools: [{ googleMaps: {} }] }
    });
    return response.text || "Sem resposta.";
  } catch (e) {
    return "Erro no assistente.";
  }
}

export const distributeAndOptimizeRoutes = async (
  drivers: DriverState[],
  destinations: DeliveryLocation[]
): Promise<Record<string, string[]>> => {
    // Simplified for logic brevity, same logic as before but with traffic emphasis in prompt
    const driverList = drivers.map(d => `- Driver ID: ${d.id}, Lat: ${d.currentCoords.lat}, Lng: ${d.currentCoords.lng}`).join('\n');
    const destList = destinations.map(d => `- Location ID: ${d.id}, Lat: ${d.coords.lat}, Lng: ${d.coords.lng}`).join('\n');

    const prompt = `Distribua entregas entre motoristas em Itajaí considerando tráfego e proximidade. 
    Motoristas: ${driverList}
    Entregas: ${destList}
    Retorne JSON: { "assignments": [{ "driverId": "id", "locationIds": ["id1"] }] }`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        assignments: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    driverId: { type: Type.STRING },
                                    locationIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                                },
                                required: ['driverId', 'locationIds']
                            }
                        }
                    }
                }
            }
        });
        const json = JSON.parse(response.text || '{}');
        const result: Record<string, string[]> = {};
        json.assignments.forEach((a: any) => result[a.driverId] = a.locationIds);
        return result;
    } catch (e) {
        return {};
    }
};
