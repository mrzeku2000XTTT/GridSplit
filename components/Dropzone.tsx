import React, { useRef, useState } from 'react';
import { UploadIcon } from './Icons';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFileSelect, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    if (!isLoading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        w-full max-w-2xl mx-auto h-64
        border-2 border-dashed rounded-xl
        flex flex-col items-center justify-center
        transition-all duration-300 cursor-pointer
        group
        ${isDragging 
          ? 'border-white bg-surfaceHighlight scale-[1.02]' 
          : 'border-border bg-surface hover:border-zinc-500 hover:bg-surfaceHighlight'
        }
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        className="hidden"
        accept="image/*"
        disabled={isLoading}
      />
      
      <div className="flex flex-col items-center gap-4 text-center p-6">
        <div className={`p-4 rounded-full bg-secondary text-white group-hover:scale-110 transition-transform duration-300`}>
          <UploadIcon className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Upload your Grid Image
          </h3>
          <p className="text-zinc-400 text-sm">
            Drag & drop or click to browse.<br/>
            Supports JPG, PNG, WEBP.
          </p>
        </div>
      </div>
    </div>
  );
};
