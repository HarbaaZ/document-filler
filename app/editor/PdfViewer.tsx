'use client';

import { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configuration du worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  file: string;
  pageNumber: number;
  scale: number;
  onLoadSuccess: (pdf: { numPages: number }) => void;
  children?: React.ReactNode;
}

export function PdfViewer({ file, pageNumber, scale, onLoadSuccess, children }: PdfViewerProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center p-20 text-zinc-600 dark:text-zinc-400">
        Chargement du lecteur PDF...
      </div>
    );
  }

  return (
    <>
      <Document
        file={file}
        onLoadSuccess={onLoadSuccess}
        loading={
          <div className="flex items-center justify-center p-20 text-zinc-600 dark:text-zinc-400">
            Chargement du PDF...
          </div>
        }
      >
        <Page
          pageNumber={pageNumber}
          scale={scale}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={
            <div className="flex items-center justify-center p-20 text-zinc-600 dark:text-zinc-400">
              Chargement de la page...
            </div>
          }
        />
      </Document>
      {children}
    </>
  );
}
