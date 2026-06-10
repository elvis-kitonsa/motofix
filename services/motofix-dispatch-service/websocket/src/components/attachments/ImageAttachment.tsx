import React, { useState } from 'react';
import { X, ZoomIn, Loader2, ImageOff } from 'lucide-react';
import type { Attachment } from '@/types/mechanic';

interface ImageAttachmentProps {
  attachment: Attachment;
}

const ImageAttachment: React.FC<ImageAttachmentProps> = ({ attachment }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <>
      {/* Thumbnail */}
      <button
        onClick={() => !hasError && setIsOpen(true)}
        className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted border border-border group focus:outline-none focus:ring-2 focus:ring-primary"
        disabled={hasError}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        )}
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted text-muted-foreground">
            <ImageOff className="w-8 h-8 mb-2" />
            <span className="text-xs">Failed to load</span>
          </div>
        ) : (
          <>
            <img
              src={attachment.url}
              alt={attachment.filename || 'Customer attachment'}
              className={`w-full h-full object-cover transition-opacity ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={handleLoad}
              onError={handleError}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        )}
      </button>

      {/* Fullscreen Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={attachment.url}
            alt={attachment.filename || 'Customer attachment'}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default ImageAttachment;
