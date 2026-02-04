import React from 'react';
import { CroppedImage } from '../types';
import { DownloadIcon, UserIcon, MagicIcon } from './Icons';

interface ResultGridProps {
  images: CroppedImage[];
  onImageClick: (image: CroppedImage) => void;
  onUpdateImage: (id: string, updates: Partial<CroppedImage>) => void;
}

export const ResultGrid: React.FC<ResultGridProps> = ({ images, onImageClick, onUpdateImage }) => {
  const handleDownload = (e: React.MouseEvent, imageUrl: string, index: number) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `crop-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    images.forEach((img, idx) => {
        // Stagger downloads slightly to prevent browser blocking
        setTimeout(() => {
             const link = document.createElement('a');
             link.href = img.url;
             link.download = `crop-${idx + 1}.png`;
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
        }, idx * 200);
    });
  };

  const handleInputClick = (e: React.MouseEvent) => {
      e.stopPropagation();
  }

  if (images.length === 0) return null;

  return (
    <div className="w-full max-w-6xl mx-auto mt-12 animate-[fadeIn_0.5s_ease-out]">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-6 gap-4 border-b border-border pb-6">
        <div>
           <h2 className="text-2xl font-bold text-white">Results</h2>
           <p className="text-zinc-400 text-sm mt-1">Found {images.length} cropped images. Click an image to setup Agents.</p>
        </div>
        
        <button
          onClick={handleDownloadAll}
          className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-lg font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
        >
          <DownloadIcon className="w-5 h-5" />
          Download All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {images.map((image, idx) => (
          <div 
            key={image.id} 
            onClick={() => onImageClick(image)}
            className="group relative bg-surface rounded-xl overflow-hidden border border-border hover:border-zinc-500 transition-all duration-300 hover:shadow-2xl hover:shadow-zinc-900/50 cursor-pointer flex flex-col"
          >
            {/* Image Section */}
            <div className="aspect-square w-full relative bg-zinc-900/50">
               {/* Checkered pattern for transparency */}
               <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}></div>
               
               <img
                src={image.url}
                alt={`Crop ${idx + 1}`}
                className="absolute inset-0 w-full h-full object-contain p-2"
              />
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-medium border border-white/20">
                      Setup Agent
                  </span>
              </div>
            </div>
            
            {/* Agent Info Section */}
            <div className="p-3 bg-surfaceHighlight/50 border-t border-border flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-zinc-500" />
                    <input 
                        type="text" 
                        value={image.agentName || ''}
                        onChange={(e) => onUpdateImage(image.id, { agentName: e.target.value })}
                        onClick={handleInputClick}
                        placeholder="Agent Name..."
                        className="bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none w-full font-medium"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                         <div className="w-1 h-1 bg-zinc-600 rounded-full" />
                    </div>
                    <input 
                        type="text" 
                        value={image.agentPersonality || ''}
                        onChange={(e) => onUpdateImage(image.id, { agentPersonality: e.target.value })}
                        onClick={handleInputClick}
                        placeholder="Personality / Role..."
                        className="bg-transparent text-xs text-zinc-400 placeholder-zinc-700 focus:outline-none w-full"
                    />
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 flex items-center justify-between bg-surface border-t border-border/50">
                <div className="flex items-center gap-2">
                     <span className="text-xs font-mono text-zinc-500">#{idx + 1}</span>
                     {image.generatedPrompt && (
                         <div title="Prompt Generated" className="p-1 rounded bg-purple-900/30 text-purple-400">
                             <MagicIcon className="w-3 h-3" />
                         </div>
                     )}
                </div>
                <button
                    onClick={(e) => handleDownload(e, image.url, idx)}
                    className="p-2 rounded-lg bg-secondary text-white hover:bg-white hover:text-black transition-colors"
                    title="Download this image"
                >
                    <DownloadIcon className="w-4 h-4" />
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
