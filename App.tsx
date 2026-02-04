import React, { useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { ResultGrid } from './components/ResultGrid';
import { ImageViewer } from './components/ImageViewer';
import { analyzeGridImage, generateAgentPrompt } from './services/geminiService';
import { cropImageFromCoordinates, fallbackGridSlice, fileToBase64, loadImage, blobUrlToBase64 } from './utils/imageUtils';
import { ProcessingStatus, CroppedImage } from './types';
import { SparklesIcon, RefreshIcon, GridIcon } from './components/Icons';

function App() {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [processedImages, setProcessedImages] = useState<CroppedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<CroppedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  const handleUpdateImage = (id: string, updates: Partial<CroppedImage>) => {
    setProcessedImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
    if (selectedImage && selectedImage.id === id) {
        setSelectedImage(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleFileSelect = async (file: File) => {
    try {
      setError(null);
      setDetailedError(null);
      setIsFallbackMode(false);
      setStatus(ProcessingStatus.ANALYZING);
      
      // Create local preview
      const objectUrl = URL.createObjectURL(file);
      setOriginalImageUrl(objectUrl);
      setProcessedImages([]);

      // 1. Convert to base64 for Gemini
      const base64 = await fileToBase64(file);

      // 2. Send to Gemini for analysis
      let crops;
      let usedFallback = false;
      
      try {
          const result = await analyzeGridImage(base64, file.type);
          crops = result.crops;
          if(!crops || crops.length === 0) throw new Error("No crops found");
      } catch (aiError: any) {
          const msg = aiError?.message || '';
          const status = aiError?.status || aiError?.code;

          // CRITICAL: Check for Auth/Permission errors. 
          const isFatalError = 
              msg === 'MISSING_API_KEY' || 
              status === 400 || 
              status === 403 || 
              status === 401 ||
              msg.includes('API key') ||
              msg.includes('permission');

          if (isFatalError) {
              throw aiError;
          }

          console.warn("AI analysis failed (non-fatal), falling back to strict 3x3 grid slice.", aiError);
          crops = [];
          usedFallback = true;
      }

      setStatus(ProcessingStatus.CROPPING);

      // 3. Process crops with Canvas
      const imgElement = await loadImage(objectUrl);
      
      let finalImages: CroppedImage[] = [];
      
      if (crops && crops.length > 0) {
          finalImages = await cropImageFromCoordinates(imgElement, crops);
      } 
      
      // If AI failed or returned very few crops, fallback to 3x3
      if (finalImages.length < 2) {
           console.log("Using fallback 3x3 slicer");
           finalImages = await fallbackGridSlice(imgElement);
           usedFallback = true;
      }

      setIsFallbackMode(usedFallback);
      setProcessedImages(finalImages);
      setStatus(ProcessingStatus.COMPLETE);

    } catch (err: any) {
      console.error(err);
      
      // Parse Error for UI
      const msg = err?.message || '';
      const status = err?.status || err?.code;
      let friendlyMsg = "Something went wrong processing your image. Please try again.";

      if (msg === 'MISSING_API_KEY') {
         friendlyMsg = "Configuration Error: API Key is missing. If you are on Vercel, please add 'VITE_API_KEY' to your Environment Variables and redeploy.";
      } else if (status === 400 || status === 403 || msg.includes('API key') || msg.includes('permission')) {
         friendlyMsg = "Access Denied: Your API Key is invalid or restricted. Please check your Google AI Studio settings.";
      } else if (status === 429 || msg.includes('429')) {
         friendlyMsg = "We're experiencing high traffic (Rate Limit Exceeded). Please try again in a moment.";
      } else if (status === 503 || msg.includes('503')) {
         friendlyMsg = "The AI service is currently overloaded. Please try again shortly.";
      }

      setError(friendlyMsg);
      // Set detailed error for debugging if available
      setDetailedError(msg !== friendlyMsg ? msg : null);
      
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const handleGeneratePrompt = async (image: CroppedImage) => {
      // Don't generate if already exists or is generating
      if (image.isEnhancingPrompt || !image.actionDescription) return;

      try {
          handleUpdateImage(image.id, { isEnhancingPrompt: true });

          // Convert blob url to base64 for API
          const base64 = await blobUrlToBase64(image.url);
          
          // Generate text prompt
          const generatedPrompt = await generateAgentPrompt(
            base64, 
            image.agentName, 
            image.agentPersonality,
            image.actionDescription
          );

          handleUpdateImage(image.id, { 
              generatedPrompt: generatedPrompt, 
              isEnhancingPrompt: false 
          });

      } catch (err: any) {
          console.error("Failed to generate prompt", err);
          handleUpdateImage(image.id, { isEnhancingPrompt: false });
          alert(`Error generating prompt: ${err?.message}`);
      }
  };

  const handleReset = () => {
    setOriginalImageUrl(null);
    setProcessedImages([]);
    setStatus(ProcessingStatus.IDLE);
    setError(null);
    setDetailedError(null);
    setSelectedImage(null);
    setIsFallbackMode(false);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-zinc-800 relative overflow-x-hidden">
        {/* Background Layer */}
        <div className="fixed inset-0 z-0 overflow-hidden">
             {originalImageUrl ? (
                 <>
                    {/* User's uploaded image as background (Blurred & Darkened) */}
                    <div className="absolute inset-0 z-0">
                         <img 
                            src={originalImageUrl} 
                            alt="Background Context" 
                            className="w-full h-full object-cover opacity-40 blur-[80px] scale-125 animate-[pulse_10s_ease-in-out_infinite]"
                         />
                    </div>
                    {/* Gradient Overlay for Readability */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/70 to-black/90 z-10" />
                 </>
             ) : (
                 <>
                    {/* Default Idle State: Technical Grid / Dark Cinematic */}
                    <div className="absolute inset-0 bg-zinc-950">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black opacity-80" />
                        
                        {/* Subtle Grid Pattern */}
                        <div 
                            className="absolute inset-0 opacity-[0.15]" 
                            style={{ 
                                backgroundImage: `linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)`,
                                backgroundSize: '40px 40px'
                            }} 
                        />
                        
                        {/* Cinematic Spotlights */}
                        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
                        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
                    </div>
                 </>
             )}
        </div>

      <div className="relative z-10 container mx-auto px-4 py-12 flex flex-col items-center">
        {/* Header */}
        <header className="text-center mb-16 space-y-4 animate-[fadeIn_1s_ease-out]">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 mb-4 shadow-2xl">
             <GridIcon className="w-8 h-8 text-white mr-3" />
             <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-lg">
               GridSplit AI
             </h1>
          </div>
          <p className="text-zinc-300 max-w-lg mx-auto text-lg font-medium drop-shadow-md bg-black/40 p-2 rounded-lg backdrop-blur-sm">
            Upload any photo grid. Our AI instantly detects and splits it into individual high-quality images.
          </p>
        </header>

        {/* Main Interface */}
        <main className="w-full max-w-5xl">
          
          {/* State: IDLE - Upload */}
          {!originalImageUrl && (
            <div className="animate-[fadeIn_0.5s_ease-out]">
                <Dropzone onFileSelect={handleFileSelect} isLoading={false} />
            </div>
          )}

          {/* State: PROCESSING or COMPLETE */}
          {originalImageUrl && (
            <div className="flex flex-col items-center w-full animate-[fadeIn_0.5s_ease-out]">
              
              {/* Preview & Status */}
              <div className="relative w-full max-w-lg mx-auto mb-12">
                 <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl shadow-black bg-black/50 backdrop-blur-sm">
                     <img 
                        src={originalImageUrl} 
                        alt="Original" 
                        className={`w-full h-auto transition-opacity duration-700 ${status === ProcessingStatus.COMPLETE ? 'opacity-50 blur-sm grayscale' : 'opacity-100'}`} 
                     />
                     
                     {/* Overlay Loader */}
                     {(status === ProcessingStatus.ANALYZING || status === ProcessingStatus.CROPPING) && (
                         <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
                             <div className="p-4 bg-zinc-900 rounded-full border border-zinc-700 animate-pulse-slow mb-4">
                                <SparklesIcon className="w-8 h-8 text-white animate-spin" />
                             </div>
                             <p className="text-white font-medium tracking-wide">
                                 {status === ProcessingStatus.ANALYZING ? 'AI Analyzing Structure...' : 'Smart Cropping...'}
                             </p>
                         </div>
                     )}

                    {/* Reset Button (Only visible when complete or error) */}
                    {status === ProcessingStatus.COMPLETE && (
                        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                             <button 
                                onClick={handleReset}
                                className="pointer-events-auto flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-full font-medium transition-all hover:scale-105"
                             >
                                <RefreshIcon className="w-5 h-5" />
                                Start Over
                             </button>
                        </div>
                    )}
                 </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-6 rounded-lg bg-red-950/40 border border-red-900/50 text-red-200 mb-8 max-w-lg text-center backdrop-blur-sm">
                    <p className="font-semibold text-lg mb-2">Error</p>
                    <p className="mb-4">{error}</p>
                    
                    {detailedError && (
                        <div className="bg-black/50 p-2 rounded text-xs text-red-400 font-mono mb-4 text-left overflow-x-auto border border-red-900/30">
                            Details: {detailedError}
                        </div>
                    )}
                    
                    <button onClick={handleReset} className="inline-block px-4 py-2 bg-red-900/30 hover:bg-red-900/50 rounded-lg text-sm font-bold transition-colors">
                        Try Again
                    </button>
                </div>
              )}

               {/* Fallback Notification */}
               {status === ProcessingStatus.COMPLETE && isFallbackMode && (
                  <div className="mb-8 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-yellow-200 text-sm max-w-2xl text-center backdrop-blur-sm animate-[fadeIn_0.5s_ease-out]">
                      <p><strong>Note:</strong> AI Analysis didn't return perfect results (likely due to image complexity or API limits). We used a standard 3x3 grid slice as a fallback.</p>
                  </div>
              )}

              {/* Results */}
              {status === ProcessingStatus.COMPLETE && (
                 <ResultGrid 
                    images={processedImages} 
                    onImageClick={setSelectedImage} 
                    onUpdateImage={handleUpdateImage}
                 />
              )}

            </div>
          )}
        </main>

        {/* Full Screen Image Viewer Modal */}
        {selectedImage && (
            <ImageViewer 
                image={selectedImage} 
                onClose={() => setSelectedImage(null)} 
                onGeneratePrompt={handleGeneratePrompt}
                onUpdateImage={handleUpdateImage}
            />
        )}
      </div>
    </div>
  );
}

export default App;