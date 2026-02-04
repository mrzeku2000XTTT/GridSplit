import { BoundingBox, CroppedImage } from "../types";

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const blobUrlToBase64 = async (blobUrl: string): Promise<string> => {
  const blob = await fetch(blobUrl).then(r => r.blob());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
  });
};

export const cropImageFromCoordinates = async (
  sourceImage: HTMLImageElement,
  crops: BoundingBox[]
): Promise<CroppedImage[]> => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  const { naturalWidth, naturalHeight } = sourceImage;
  const processedImages: CroppedImage[] = [];

  for (let i = 0; i < crops.length; i++) {
    const box = crops[i];

    // Convert normalized 0-1000 coords to pixels
    const x = Math.floor((box.xmin / 1000) * naturalWidth);
    const y = Math.floor((box.ymin / 1000) * naturalHeight);
    const w = Math.floor(((box.xmax - box.xmin) / 1000) * naturalWidth);
    const h = Math.floor(((box.ymax - box.ymin) / 1000) * naturalHeight);

    // Validate dimensions
    if (w <= 0 || h <= 0) continue;

    canvas.width = w;
    canvas.height = h;

    // Draw only the cropped portion
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(sourceImage, x, y, w, h, 0, 0, w, h);

    // Get Blob URL
    const blob = await new Promise<Blob | null>((resolve) => 
      canvas.toBlob(resolve, "image/png", 1.0)
    );

    if (blob) {
      const url = URL.createObjectURL(blob);
      processedImages.push({
        id: `crop-${Date.now()}-${i}`,
        url,
        originalIndex: i,
      });
    }
  }

  return processedImages;
};

// Fallback logic if AI fails or returns empty: strictly slice 3x3
export const fallbackGridSlice = async (sourceImage: HTMLImageElement): Promise<CroppedImage[]> => {
    const { naturalWidth, naturalHeight } = sourceImage;
    const cellW = Math.floor(naturalWidth / 3);
    const cellH = Math.floor(naturalHeight / 3);
    
    // Generate 3x3 grid boxes
    const crops: BoundingBox[] = [];
    for(let r=0; r<3; r++) {
        for(let c=0; c<3; c++) {
            crops.push({
                xmin: Math.floor((c * cellW / naturalWidth) * 1000),
                xmax: Math.floor(((c + 1) * cellW / naturalWidth) * 1000),
                ymin: Math.floor((r * cellH / naturalHeight) * 1000),
                ymax: Math.floor(((r + 1) * cellH / naturalHeight) * 1000),
            });
        }
    }
    return cropImageFromCoordinates(sourceImage, crops);
};
