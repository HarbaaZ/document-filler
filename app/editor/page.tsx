'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Import dynamique du composant PDF Viewer
const PdfViewer = dynamic(
  () => import('./PdfViewer').then((mod) => ({ default: mod.PdfViewer })),
  { ssr: false, loading: () => <div className="p-20 text-center">Chargement...</div> }
);

interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  fontSize?: number;
  alignment?: 'left' | 'center' | 'right';
}

export default function EditorPage() {
  const [pdfList, setPdfList] = useState<string[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [tempZone, setTempZone] = useState<Zone | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1.5);

  useEffect(() => {
    loadPdfList();
  }, []);

  useEffect(() => {
    if (selectedPdf) {
      loadZones();
    }
  }, [selectedPdf]);

  const loadPdfList = async () => {
    try {
      const response = await fetch('/api/upload');
      const data = await response.json();
      if (data.success && data.files.length > 0) {
        setPdfList(data.files);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la liste:', error);
    }
  };

  const loadZones = async () => {
    try {
      const response = await fetch(`/api/zones?template=${selectedPdf}`);
      const data = await response.json();
      if (data.success) {
        setZones(data.zones || []);
        setMessage('✅ Zones chargées');
        setTimeout(() => setMessage(''), 2000);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des zones:', error);
    }
  };

  const saveZones = async () => {
    try {
      const response = await fetch('/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: selectedPdf,
          zones: zones
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`✅ ${data.zonesCount} zone(s) sauvegardée(s)`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setMessage('❌ Erreur lors de la sauvegarde');
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;

    // Trouver le canvas PDF à l'intérieur du conteneur
    const pdfCanvas = canvasRef.current.querySelector('canvas');
    if (!pdfCanvas) return;

    const rect = pdfCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setIsDrawing(true);
    setStartPoint({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint || !canvasRef.current) return;

    // Trouver le canvas PDF à l'intérieur du conteneur
    const pdfCanvas = canvasRef.current.querySelector('canvas');
    if (!pdfCanvas) return;

    const rect = pdfCanvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / scale;
    const currentY = (e.clientY - rect.top) / scale;

    const width = Math.abs(currentX - startPoint.x);
    const height = Math.abs(currentY - startPoint.y);
    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);

    setTempZone({
      id: 'temp',
      name: '',
      x,
      y,
      width,
      height,
      page: currentPage,
      fontSize: 12,
      alignment: 'left'
    });
  };

  const handleMouseUp = () => {
    if (tempZone && tempZone.width > 10 && tempZone.height > 10) {
      const zoneName = prompt('Nom du champ:');
      if (zoneName) {
        const newZone: Zone = {
          ...tempZone,
          id: Date.now().toString(),
          name: zoneName
        };
        setZones([...zones, newZone]);
      }
    }

    setIsDrawing(false);
    setStartPoint(null);
    setTempZone(null);
  };

  const deleteZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id));
    setSelectedZone(null);
  };

  const currentPageZones = zones.filter(z => z.page === currentPage);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
          Éditeur de Zones PDF
        </h1>

        {/* Sélection du PDF */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
          <label className="block mb-2 font-semibold text-zinc-900 dark:text-zinc-50">
            Sélectionner un template PDF:
          </label>
          <select
            value={selectedPdf}
            onChange={(e) => {
              setSelectedPdf(e.target.value);
              setCurrentPage(1);
              setZones([]);
            }}
            className="w-full p-2 border rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
          >
            <option value="">-- Choisir un PDF --</option>
            {pdfList.map(pdf => (
              <option key={pdf} value={pdf}>{pdf}</option>
            ))}
          </select>

          {selectedPdf && (
            <div className="mt-4 flex gap-4">
              <button
                onClick={saveZones}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Sauvegarder les zones
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-2 bg-zinc-600 text-white rounded hover:bg-zinc-700"
              >
                Retour à l'accueil
              </button>
            </div>
          )}

          {message && (
            <div className="mt-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded text-sm">
              {message}
            </div>
          )}
        </div>

        {selectedPdf && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Zone PDF */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-zinc-700 text-white rounded disabled:opacity-50 mr-2"
                  >
                    ← Page précédente
                  </button>
                  <span className="text-zinc-900 dark:text-zinc-50">
                    Page {currentPage} / {numPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                    disabled={currentPage === numPages}
                    className="px-4 py-2 bg-zinc-700 text-white rounded disabled:opacity-50 ml-2"
                  >
                    Page suivante →
                  </button>
                </div>
                <div>
                  <button
                    onClick={() => setScale(Math.max(0.5, scale - 0.25))}
                    className="px-3 py-1 bg-zinc-600 text-white rounded mr-2"
                  >
                    -
                  </button>
                  <span className="text-zinc-900 dark:text-zinc-50">{Math.round(scale * 100)}%</span>
                  <button
                    onClick={() => setScale(Math.min(3, scale + 0.25))}
                    className="px-3 py-1 bg-zinc-600 text-white rounded ml-2"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="border-2 border-zinc-300 dark:border-zinc-700 rounded overflow-auto max-h-[800px] flex justify-center items-start p-4">
                <div
                  ref={canvasRef}
                  className="relative cursor-crosshair inline-block"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <PdfViewer
                    file={`/documents/${selectedPdf}`}
                    pageNumber={currentPage}
                    scale={scale}
                    onLoadSuccess={onDocumentLoadSuccess}
                  >
                    {/* Zones existantes */}
                  {currentPageZones.map(zone => (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedZone(zone.id)}
                      style={{
                        position: 'absolute',
                        left: zone.x * scale,
                        top: zone.y * scale,
                        width: zone.width * scale,
                        height: zone.height * scale,
                        border: selectedZone === zone.id ? '3px solid #3b82f6' : '2px solid #ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        pointerEvents: 'auto',
                        cursor: 'pointer'
                      }}
                    >
                      <div className="text-xs font-bold text-red-900 bg-red-200 px-1 whitespace-nowrap overflow-hidden">
                        {zone.name}
                      </div>
                    </div>
                  ))}

                  {/* Zone temporaire pendant le dessin */}
                  {tempZone && (
                    <div
                      style={{
                        position: 'absolute',
                        left: tempZone.x * scale,
                        top: tempZone.y * scale,
                        width: tempZone.width * scale,
                        height: tempZone.height * scale,
                        border: '2px dashed #3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        pointerEvents: 'none'
                      }}
                    />
                  )}
                  </PdfViewer>
                </div>
              </div>

              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                💡 Cliquez et glissez pour dessiner une zone sur le PDF
              </p>
            </div>

            {/* Liste des zones */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
                Zones définies ({zones.length})
              </h2>

              {zones.length === 0 ? (
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                  Aucune zone définie. Dessinez sur le PDF pour commencer.
                </p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {zones.map(zone => (
                    <div
                      key={zone.id}
                      className={`p-3 border rounded cursor-pointer ${
                        selectedZone === zone.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-zinc-300 dark:border-zinc-700'
                      }`}
                      onClick={() => {
                        setSelectedZone(zone.id);
                        setCurrentPage(zone.page);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {zone.name}
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">
                            Page {zone.page}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-500">
                            {Math.round(zone.x)}, {Math.round(zone.y)} -
                            {Math.round(zone.width)}×{Math.round(zone.height)}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Supprimer la zone "${zone.name}" ?`)) {
                              deleteZone(zone.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-800 font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
