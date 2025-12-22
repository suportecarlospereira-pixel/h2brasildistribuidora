import { GoogleGenAI, Type } from "@google/genai";
import { DeliveryLocation, DriverState } from '../types';

// Per guidelines: "The API key must be obtained exclusively from the environment variable process.env.API_KEY"
// We assume process.env.API_KEY is available and valid.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Single Driver TSP (Legacy support)
export const optimizeRouteOrder = async (
  startPoint: DeliveryLocation,
  destinations: DeliveryLocation[]
): Promise<string[]> => {
  if (!process.env.API_KEY) {
      console.warn("API Key is missing. Returning original order.");
      return destinations.map(d => d.id);
  }
  
  if (destinations.length === 0) return [];
  if (destinations.length === 1) return [destinations[0].id];

  const destList = destinations.map(d => `- ID: ${d.id}, Nome: ${d.name}, Lat: ${d.coords.lat}, Lng: ${d.coords.lng}`).join('\n');

  const prompt = `
    Atue como um especialista em logística.
    Entregador em: ${startPoint.name} (Lat: ${startPoint.coords.lat}, Lng: ${startPoint.coords.lng}).
    Destinos:
    ${destList}

    Retorne APENAS um array JSON de strings com os IDs na ordem otimizada (TSP).
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

// Multi-Driver VRP (Vehicle Routing Problem)
export const distributeAndOptimizeRoutes = async (
  drivers: DriverState[],
  destinations: DeliveryLocation[]
): Promise<Record<string, string[]>> => {
  if (!process.env.API_KEY) {
      console.warn("API Key is missing. Using round-robin distribution.");
      const result: Record<string, string[]> = {};
      drivers.forEach(d => result[d.id] = []);
      destinations.forEach((d, i) => {
          const driverIndex = i % drivers.length;
          result[drivers[driverIndex].id].push(d.id);
      });
      return result;
  }

  if (destinations.length === 0) return {};

  const driverList = drivers.map(d => `- Driver ID: ${d.id}, Nome: ${d.name}, Lat: ${d.currentCoords.lat}, Lng: ${d.currentCoords.lng}`).join('\n');
  const destList = destinations.map(d => `- Location ID: ${d.id}, Nome: ${d.name}, Lat: ${d.coords.lat}, Lng: ${d.coords.lng}`).join('\n');

  const prompt = `
    Atue como um gestor de frotas da H2 Brasil Distribuidora em Itajaí, SC.
    
    Temos os seguintes MOTORISTAS disponíveis com suas localizações atuais:
    ${driverList}

    Temos as seguintes ENTREGAS a serem realizadas:
    ${destList}

    OBJETIVO: Distribua TODAS as entregas entre os motoristas de forma eficiente (Vehicle Routing Problem).
    Considere a proximidade inicial do motorista com os pontos de entrega.
    Um motorista pode ficar sem entregas se for muito ineficiente usá-lo.
    
    Retorne um Objeto JSON onde a chave é o ID do motorista e o valor é um Array de IDs dos locais de entrega, na ordem otimizada de visita.
    Exemplo: { "driver-01": ["loc-a", "loc-b"], "driver-02": ["loc-c"] }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        // Using generic object as schema to allow dynamic driver IDs keys
        responseSchema: {
          type: Type.OBJECT,
          properties: {} 
        }
      }
    });

    let jsonStr = response.text?.trim();
    // Simple cleanup if md block exists
    if (jsonStr?.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
    }
    
    if (jsonStr) {
      return JSON.parse(jsonStr);
    }
    
    throw new Error("Invalid JSON");

  } catch (error) {
    console.error("Erro na distribuição:", error);
    // Fallback: Distribute Round Robin
    const result: Record<string, string[]> = {};
    drivers.forEach(d => result[d.id] = []);
    destinations.forEach((d, i) => {
        const driverIndex = i % drivers.length;
        result[drivers[driverIndex].id].push(d.id);
    });
    return result;
  }
};

export const getSmartAssistantResponse = async (query: string): Promise<string> => {
  if (!process.env.API_KEY) return "Erro de Configuração: API Key do Google Gemini não encontrada.";

  try {
     const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest',
      contents: `Você é um assistente logístico inteligente da H2 Brasil Distribuidora. 
      Responda à pergunta do usuário de forma breve, profissional e útil.
      Contexto atual: Entregas em Itajaí, SC (UBS, CRAS, Teatro Municipal).
      Pergunta do Usuário: ${query}`,
      config: {
        tools: [{ googleMaps: {} }],
      }
    });
    
    let text = response.text || "Desculpe, não consegui processar sua solicitação no momento.";

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
        const links: string[] = [];
        chunks.forEach((c: any) => {
            if (c.web?.uri) links.push(c.web.uri);
            if (c.maps?.uri) links.push(c.maps.uri);
        });
        
        if (links.length > 0) {
            text += "\n\nFontes:\n" + [...new Set(links)].join('\n');
        }
    }

    return text;
  } catch (e) {
    console.error(e);
    return "Erro ao consultar o assistente inteligente.";
  }
}