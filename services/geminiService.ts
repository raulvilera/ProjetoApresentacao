
import { GoogleGenAI, Type } from "@google/genai";

// Analyze incident using Gemini API to determine severity and suggested conduct
export async function analyzeIncident(description: string) {
  // Ensure the API key is available from environment variables
  if (!process.env.API_KEY) return null;

  // Initialize the GenAI client inside the function to ensure the most up-to-date configuration
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analise a seguinte ocorrência escolar e forneça uma classificação de gravidade (Baixa, Média, Alta, Crítica) e uma breve sugestão de conduta: "${description}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            severity: {
              type: Type.STRING,
              description: "A gravidade calculada (Baixa, Média, Alta ou Crítica)",
            },
            recommendation: {
              type: Type.STRING,
              description: "Uma breve sugestão de como proceder",
            }
          },
          required: ["severity", "recommendation"]
        }
      }
    });

    // Directly access the text property as per documentation
    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error("Erro ao analisar com Gemini:", error);
  }
  return null;
}

