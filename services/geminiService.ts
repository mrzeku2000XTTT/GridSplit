import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, BoundingBox } from "../types";

// Helper to get the AI client lazily. 
// This prevents the app from crashing on startup if the API Key is missing or process.env is undefined.
// We also check import.meta.env for Vite environments where process.env might be empty.
const getAiClient = () => {
  const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is missing from process.env and import.meta.env");
  }
  // Initialize even with empty key to allow the app to load; calls will fail gracefully later.
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to retry operations on 429 (Rate Limit) or 503 (Overloaded)
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.status === 429 || error?.code === 429 || (error?.message && error.message.includes('429'));
    const isOverloaded = error?.status === 503 || error?.code === 503 || (error?.message && error.message.includes('503'));

    if (retries > 0 && (isRateLimit || isOverloaded)) {
        // Parse retry delay from error message if available (e.g., "Please retry in 14.85s")
        let delay = baseDelay * Math.pow(2, 3 - retries); // Default backoff
        
        if (error?.message) {
            const match = error.message.match(/retry in (\d+(\.\d+)?)s/);
            if (match && match[1]) {
                delay = Math.ceil(parseFloat(match[1]) * 1000) + 1000; // Add 1s buffer
            }
        }

        console.warn(`API busy (429/503). Retrying in ${delay}ms...`, error.message);
        await wait(delay);
        return withRetry(fn, retries - 1, baseDelay);
    }
    throw error;
  }
}

/**
 * Analyzes an image to find crop coordinates for a grid.
 * @param base64Image The base64 encoded image string (without data:image/ type prefix)
 * @param mimeType The mime type of the image
 */
export const analyzeGridImage = async (
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<AnalysisResult> => {
  return withRetry(async () => {
    try {
      const ai = getAiClient();
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
              text: `Analyze this image carefully. It is expected to be a grid of photos (likely a 3x3 grid, but could vary). 
              Task: Identify the precise bounding boxes for every distinct sub-image in the grid. 
              
              CRITICAL INSTRUCTIONS:
              1. Exclude all borders, frames, gutters, and whitespace between images. The crops should be tight on the content.
              2. Return the bounding boxes as normalized integer coordinates (0-1000). 
              3. Sort the output row by row, from top-left to bottom-right.
              
              Take your time to detect the exact boundaries of each cell.`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingBudget: 2048 }, // Force the model to think/reason about boundaries
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              crops: {
                type: Type.ARRAY,
                description: "List of bounding boxes for each detected sub-image.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ymin: {
                      type: Type.INTEGER,
                      description: "Top Y coordinate (0-1000)",
                    },
                    xmin: {
                      type: Type.INTEGER,
                      description: "Left X coordinate (0-1000)",
                    },
                    ymax: {
                      type: Type.INTEGER,
                      description: "Bottom Y coordinate (0-1000)",
                    },
                    xmax: {
                      type: Type.INTEGER,
                      description: "Right X coordinate (0-1000)",
                    },
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
      if (!text) {
        throw new Error("No response from AI");
      }

      const data = JSON.parse(text) as AnalysisResult;
      return data;
    } catch (error) {
      console.error("Gemini Analysis Failed:", error);
      throw error;
    }
  });
};

/**
 * Generates an Enhanced Image Prompt based on the character, personality, and action.
 */
export const generateAgentPrompt = async (
  base64Image: string, 
  agentName: string = "The Character", 
  agentPersonality: string = "Cinematic and detailed",
  actionDescription: string
): Promise<string> => {
    return withRetry(async () => {
        try {
            const ai = getAiClient();
            // We use Gemini 3 Flash for text reasoning/creative writing
            const modelId = "gemini-3-flash-preview";

            const prompt = `
            You are an expert AI Prompt Engineer. 
            I have a character image (attached) that is part of a larger story.
            
            Character Name: ${agentName}
            Character Personality/Vibe: ${agentPersonality}
            Desired Action/Scene: ${actionDescription}

            Please write a highly detailed, high-quality image generation prompt (for Midjourney or Flux) that:
            1. Describes the character physically based on the attached image (hair, clothes, features).
            2. Puts them in the scene described by "Desired Action".
            3. Incorporates the mood/lighting based on the "Personality/Vibe".
            4. Uses professional photography keywords (e.g., 8k, photorealistic, cinematic lighting, depth of field).
            
            Output ONLY the raw prompt text. Do not add "Here is the prompt:" or quotes.
            `;

            const response = await ai.models.generateContent({
                model: modelId,
                contents: {
                    parts: [
                        {
                            inlineData: {
                                data: base64Image,
                                mimeType: 'image/png',
                            }
                        },
                        {
                            text: prompt
                        }
                    ]
                }
            });

            if (response.text) {
                return response.text.trim();
            }
            
            throw new Error("No prompt generated by AI");
        } catch (error) {
            console.error("Prompt Generation Failed:", error);
            throw error;
        }
    });
};