import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, BoundingBox } from "../types";

// Helper to get the AI client lazily. 
// Checks multiple environment variable patterns to ensure it works on Vercel/Vite/Next.
const getAiClient = () => {
  const apiKey = 
    process.env.API_KEY || 
    (import.meta as any).env?.VITE_API_KEY || 
    (import.meta as any).env?.NEXT_PUBLIC_API_KEY ||
    (import.meta as any).env?.REACT_APP_API_KEY;

  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to retry operations on 429 (Rate Limit) or 503 (Overloaded)
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // If it's a missing key, don't retry, just fail immediately
    if (error.message === "MISSING_API_KEY") throw error;

    const isRateLimit = error?.status === 429 || error?.code === 429 || (error?.message && error.message.includes('429'));
    const isOverloaded = error?.status === 503 || error?.code === 503 || (error?.message && error.message.includes('503'));

    if (retries > 0 && (isRateLimit || isOverloaded)) {
        let delay = baseDelay * Math.pow(2, 2 - retries); 
        console.warn(`API busy (429/503). Retrying in ${delay}ms...`, error.message);
        await wait(delay);
        return withRetry(fn, retries - 1, baseDelay);
    }
    throw error;
  }
}

/**
 * Analyzes an image to find crop coordinates for a grid.
 * implements a "Thinking" strategy first, falling back to "Standard" if that fails.
 */
export const analyzeGridImage = async (
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<AnalysisResult> => {
  
  // Define the core analysis logic as a reusable function
  const attemptAnalysis = async (useThinking: boolean) => {
    return withRetry(async () => {
        const ai = getAiClient();
        // Use gemini-3-flash-preview for best multimodal performance
        const modelId = "gemini-3-flash-preview";

        const response = await ai.models.generateContent({
          model: modelId,
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Image,
                  mimeType: mimeType,
                },
              },
              {
                text: `Analyze this image. It is a grid of photos.
                Identify the bounding boxes for every distinct sub-image.
                Exclude borders, gutters, and frames.
                Return normalized integer coordinates (0-1000).
                Sort row by row.`,
              },
            ],
          },
          config: {
            // Only use thinking if requested and budget is safe
            thinkingConfig: useThinking ? { thinkingBudget: 2048 } : undefined,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                crops: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      ymin: { type: Type.INTEGER },
                      xmin: { type: Type.INTEGER },
                      ymax: { type: Type.INTEGER },
                      xmax: { type: Type.INTEGER },
                    },
                    required: ["ymin", "xmin", "ymax", "xmax"],
                  },
                },
              },
              required: ["crops"],
            },
          },
        });

        const text = response.text;
        if (!text) throw new Error("No response text from AI");
        return JSON.parse(text) as AnalysisResult;
    });
  };

  try {
    // Attempt 1: Try with Thinking Config (Slower, more accurate)
    console.log("Attempting analysis with Thinking Config...");
    return await attemptAnalysis(true);
  } catch (error: any) {
    if (error.message === "MISSING_API_KEY") throw error;

    // Attempt 2: Fallback to Standard Analysis (Faster, less complex)
    console.warn("Thinking analysis failed, retrying with standard analysis...", error);
    try {
        return await attemptAnalysis(false);
    } catch (retryError) {
        console.error("All AI analysis attempts failed:", retryError);
        throw retryError;
    }
  }
};

/**
 * Generates an Enhanced Image Prompt.
 */
export const generateAgentPrompt = async (
  base64Image: string, 
  agentName: string = "The Character", 
  agentPersonality: string = "Cinematic and detailed",
  actionDescription: string
): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const modelId = "gemini-3-flash-preview";

        const prompt = `
        Character: ${agentName}
        Vibe: ${agentPersonality}
        Action: ${actionDescription}
        
        Write a detailed image generation prompt (photorealistic, 8k) based on the attached character image and the description above.
        Output ONLY the raw prompt text.
        `;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: {
                parts: [
                    { inlineData: { data: base64Image, mimeType: 'image/png' } },
                    { text: prompt }
                ]
            }
        });

        if (response.text) return response.text.trim();
        throw new Error("No prompt generated");
    });
};