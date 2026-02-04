export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface CroppedImage {
  id: string;
  url: string; // Base64 or Blob URL
  originalIndex: number; // 0-8 usually
  
  // Agent / Character Data
  agentName?: string;
  agentPersonality?: string;
  
  // Prompt Generation Data
  actionDescription?: string; // User input: "Eating a burger"
  generatedPrompt?: string;   // AI Output: "Cinematic shot of [Name], a [Personality] character..."
  isEnhancingPrompt?: boolean; // Loading state
}

export interface AnalysisResult {
  crops: BoundingBox[];
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING', // AI is thinking
  CROPPING = 'CROPPING',   // Canvas is working
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}
