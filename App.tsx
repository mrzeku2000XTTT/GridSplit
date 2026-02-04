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

  const getFriendlyErrorMessage = (err: any) => {
    const msg = err?.message || '';
    if (err?.status === 429 || msg.includes('429')) {
      return "We're experiencing high traffic (Rate Limit Exceeded). Please try again in a moment.";
    }
    if (err?.status === 503 || msg.includes('503')) {
      return "The AI service is currently overloaded. Please try again shortly.";
    }
    return "Something went wrong processing your image. Please try again.";
  };

  const handleUpdateImage = (id: string, updates: Partial<CroppedImage>) => {
    setProcessedImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
    if (selectedImage && selectedImage.id === id) {
        setSelectedImage(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleFileSelect = async (file: File) => {
    try {
      setError(null);
      setStatus(ProcessingStatus.ANALYZING);
      
      // Create local preview
      const objectUrl = URL.createObjectURL(file);
      setOriginalImageUrl(objectUrl);
      setProcessedImages([]);

      // 1. Convert to base64 for Gemini
      const base64 = await fileToBase64(file);

      // 2. Send to Gemini for analysis
      let crops;
      try {
          const result = await analyzeGridImage(base64, file.type);
          crops = result.crops;
          if(!crops || crops.length === 0) throw new Error("No crops found");
      } catch (aiError) {
          console.warn("AI analysis failed, falling back to strict 3x3 grid slice.", aiError);
          // Only fallback if it's NOT a critical API failure we want to show (like 429 persistence)
          // But for now, fallback is better than broken UI, unless it was a rate limit.
          // However, fallbackGridSlice doesn't use AI, so it's safe to use if AI fails.
          crops = [];
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
      }

      setProcessedImages(finalImages);
      setStatus(ProcessingStatus.COMPLETE);

    } catch (err) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
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
          
          alert(getFriendlyErrorMessage(err));
      }
  };

  const handleReset = () => {
    setOriginalImageUrl(null);
    setProcessedImages([]);
    setStatus(ProcessingStatus.IDLE);
    setError(null);
    setSelectedImage(null);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-zinc-800 relative overflow-x-hidden">
        {/* Background Image & Overlay */}
        <div className="fixed inset-0 z-0">
             {/* Cinematic Earth Splitting / Canyon Background */}
             <img 
                src="https://images.unsplash.com/photo-1535063404122-8356d773db4b?q=80&w=2069&auto=format&fit=crop" 
                alt="Split Earth Background" 
                className="w-full h-full object-cover opacity-80 select-none"
             />
             {/* Subtle Overlay to ensure text readability without hiding the image */}
             <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/80" />
             <div className="absolute inset-0 bg-black/20" />
        </div>

      <div className="relative z-10 container mx-auto px-4 py-12 flex flex-col items-center">
        {/* Header */}
        <header className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 mb-4 shadow-2xl">
             <GridIcon className="w-8 h-8 text-white mr-3" />
             <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-lg">
               GridSplit AI
             </h1>
          </div>
          <p className="text-zinc-200 max-w-lg mx-auto text-lg font-medium drop-shadow-md bg-black/30 p-2 rounded-lg backdrop-blur-sm">
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
                        <div className="absolute inset-0 flex items-center justify-center z-30">
                             <button 
                                onClick={handleReset}
                                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-full font-medium transition-all hover:scale-105"
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
                <div className="p-4 rounded-lg bg-red-900/20 border border-red-900/50 text-red-200 mb-8 max-w-md text-center backdrop-blur-sm">
                    {error}
                    <button onClick={handleReset} className="block w-full mt-2 text-sm font-bold underline hover:no-underline">Try Again</button>
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