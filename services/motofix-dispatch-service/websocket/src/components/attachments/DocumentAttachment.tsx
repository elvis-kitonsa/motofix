import React from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';
import type { Attachment } from '@/types/mechanic';

interface DocumentAttachmentProps {
  attachment: Attachment;
}

const DocumentAttachment: React.FC<DocumentAttachmentProps> = ({ attachment }) => {
  const filename = attachment.filename || 'Document';
  const isPdf = attachment.mime_type?.includes('pdf') || filename.toLowerCase().endsWith('.pdf');

  const handleOpen = () => {
    window.open(attachment.url, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const response = await fetch(attachment.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Fallback: open in new tab
      window.open(attachment.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted border border-border">
      {/* Document Icon */}
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <FileText className="w-6 h-6 text-primary" />
      </div>

      {/* Document Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {filename}
        </p>
        <p className="text-xs text-muted-foreground">
          {isPdf ? 'PDF Document' : 'Document'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleDownload}
          className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Download"
        >
          <Download className="w-5 h-5" />
        </button>
        <button
          onClick={handleOpen}
          className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Open in new tab"
        >
          <ExternalLink className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default DocumentAttachment;
