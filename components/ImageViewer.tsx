import React, { useState } from 'react';
import { CroppedImage } from '../types';
import { CloseIcon, MagicIcon, DownloadIcon, SparklesIcon, UserIcon, ClipboardIcon } from './Icons';

interface ImageViewerProps {
  image: CroppedImage | null;
  onClose: () => void;
  onGeneratePrompt: (image: CroppedImage) => void;
  onUpdateImage: (id: string, updates: Partial<CroppedImage>) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ image, onClose, onGeneratePrompt, onUpdateImage }) => {
  const [copied, setCopied] = useState(false);

  if (!image) return null;

  const handleDownload = (url: string, prefix: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prefix}-${image.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = async () => {
      if (image.generatedPrompt) {
          await navigator.clipboard.writeText(image.generatedPrompt);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-xl transition-opacity animate-[fadeIn_0.3s_ease-out]" 
        onClick={onClose}
      />

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row gap-6 animate-[scaleIn_0.3s_ease-out]">
        
        {/* Close Button Mobile */}
        <button 
          onClick={onClose} 
          className="absolute -top-12 right-0 md:hidden p-2 bg-white/10 rounded-full text-white"
        >
          <CloseIcon className="w-6 h-6" />
        </button>

        {/* Original Image View */}
        <div className="flex-1 flex flex-col gap-4">
             <div className="relative bg-zinc-900/50 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center min-h-[400px]">
                {/* Checkerboard */}
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)', backgroundSize: '20px 20px' }}></div>
                
                <img 
                    src={image.url} 
                    alt="Original Crop" 
                    className="relative max-h-[70vh] w-auto object-contain"
                />
             </div>
             <div className="flex items-center justify-between px-2">
                 <h3 className="text-white font-medium text-lg">Original Crop</h3>
                 <button 
                    onClick={() => handleDownload(image.url, 'crop')}
                    className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                 >
                    <DownloadIcon className="w-4 h-4" /> Download
                 </button>
             </div>
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-96 flex flex-col gap-4 overflow-y-auto">
            
            {/* Desktop Close */}
            <div className="hidden md:flex justify-end">
                <button 
                  onClick={onClose}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                  <CloseIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Agent Profile Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
                 <div className="flex items-center gap-2 text-zinc-400 mb-1">
                    <UserIcon className="w-5 h-5" />
                    <span className="text-sm font-semibold uppercase tracking-wider">Agent Profile</span>
                </div>
                
                <div className="space-y-4">
                     <div>
                         <label className="text-xs text-zinc-500 mb-1.5 block font-medium">Character Name</label>
                         <input 
                            type="text"
                            value={image.agentName || ''}
                            onChange={(e) => onUpdateImage(image.id, { agentName: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
                            placeholder="e.g. Agent Smith"
                         />
                     </div>
                     <div>
                         <label className="text-xs text-zinc-500 mb-1.5 block font-medium">Personality / Vibe</label>
                         <textarea 
                            value={image.agentPersonality || ''}
                            onChange={(e) => onUpdateImage(image.id, { agentPersonality: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors resize-none h-20"
                            placeholder="e.g. Mysterious, cyberpunk, neon lighting..."
                         />
                     </div>
                </div>
            </div>

            {/* Prompt Generator Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 flex-1">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                    <MagicIcon className="w-5 h-5" />
                    <span className="text-sm font-semibold uppercase tracking-wider">AI Prompt Generator</span>
                </div>

                <div className="flex flex-col gap-4">
                    <div>
                         <label className="text-xs text-zinc-500 mb-1.5 block font-medium">Desired Action / Scene</label>
                         <textarea 
                            value={image.actionDescription || ''}
                            onChange={(e) => onUpdateImage(image.id, { actionDescription: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors resize-none h-24"
                            placeholder="e.g. Running through a rainy futuristic city holding a glowing artifact."
                         />
                    </div>

                    {!image.generatedPrompt ? (
                         <button
                            onClick={() => onGeneratePrompt(image)}
                            disabled={image.isEnhancingPrompt || !image.actionDescription}
                            className={`
                                w-full py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all
                                ${image.isEnhancingPrompt || !image.actionDescription
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                    : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-900/20 active:scale-95'
                                }
                            `}
                        >
                            {image.isEnhancingPrompt ? 'Enhancing...' : 'Generate AI Prompt'}
                            {!image.isEnhancingPrompt && <SparklesIcon className="w-4 h-4" />}
                        </button>
                    ) : (
                        <div className="animate-[fadeIn_0.5s_ease-out] flex flex-col gap-3">
                            <label className="text-xs text-zinc-500 font-medium">Generated Prompt</label>
                            <div className="bg-black/50 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-300 max-h-48 overflow-y-auto leading-relaxed">
                                {image.generatedPrompt}
                            </div>
                            
                            <div className="flex gap-2">
                                <button
                                    onClick={copyToClipboard}
                                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
                                >
                                    {copied ? 'Copied!' : 'Copy Prompt'}
                                    {!copied && <ClipboardIcon className="w-4 h-4" />}
                                </button>
                                <button
                                     onClick={() => onGeneratePrompt(image)}
                                     disabled={image.isEnhancingPrompt}
                                     className="p-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
                                     title="Regenerate"
                                >
                                    <SparklesIcon className={`w-5 h-5 ${image.isEnhancingPrompt ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
