import React from 'react';
import { Paperclip } from 'lucide-react';
import type { Attachment } from '@/types/mechanic';
import ImageAttachment from './ImageAttachment';
import AudioAttachment from './AudioAttachment';
import DocumentAttachment from './DocumentAttachment';

interface AttachmentListProps {
  attachments: Attachment[];
  className?: string;
}

/**
 * AttachmentList - Renders a list of customer attachments
 * 
 * Displays different attachment types appropriately:
 * - Images: Thumbnail grid with fullscreen preview on tap
 * - Audio: Inline audio player with play/pause controls
 * - Documents: Download/preview buttons for PDFs and other docs
 * 
 * Mobile-first design with large touch targets
 */
const AttachmentList: React.FC<AttachmentListProps> = ({ attachments, className = '' }) => {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  // Group attachments by type for organized display
  const imageAttachments = attachments.filter(a => a.type === 'image');
  const audioAttachments = attachments.filter(a => a.type === 'audio');
  const documentAttachments = attachments.filter(a => a.type === 'document');

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Paperclip className="w-4 h-4" />
        <span className="text-sm font-medium">
          {attachments.length} Attachment{attachments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Images - Grid layout for multiple images */}
      {imageAttachments.length > 0 && (
        <div className={`grid gap-3 ${imageAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {imageAttachments.map((attachment) => (
            <ImageAttachment key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}

      {/* Audio - Stack vertically */}
      {audioAttachments.length > 0 && (
        <div className="space-y-3">
          {audioAttachments.map((attachment) => (
            <AudioAttachment key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}

      {/* Documents - Stack vertically */}
      {documentAttachments.length > 0 && (
        <div className="space-y-3">
          {documentAttachments.map((attachment) => (
            <DocumentAttachment key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AttachmentList;
