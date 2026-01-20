'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [templateList, setTemplateList] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Veuillez sélectionner un fichier');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ ${data.message} - ${data.filename}`);
        setFile(null);
        loadTemplateList();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Erreur lors de l\'upload');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const loadTemplateList = async () => {
    try {
      const response = await fetch('/api/upload');
      const data = await response.json();
      if (data.success) {
        setTemplateList(data.files);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la liste:', error);
    }
  };

  useEffect(() => {
    loadTemplateList();
  }, []);

  const pdfTemplates = templateList.filter(t => t.endsWith('.pdf'));
  const htmlTemplates = templateList.filter(t => t.endsWith('.html'));

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black p-8">
      <main className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-zinc-900 dark:text-zinc-50">
          PDF & HTML Filler - Gestionnaire de Templates
        </h1>

        {/* Section Upload */}
        <div className="mb-8 p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-zinc-200">
            Uploader un template (PDF ou HTML)
          </h2>

          <div className="space-y-4">
            <input
              type="file"
              accept=".pdf,.html"
              onChange={handleFileChange}
              className="block w-full text-sm text-zinc-900 dark:text-zinc-100
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-zinc-900 file:text-white
                dark:file:bg-zinc-50 dark:file:text-zinc-900
                hover:file:bg-zinc-700 dark:hover:file:bg-zinc-200
                cursor-pointer"
            />

            {file && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Fichier sélectionné: {file.name}
              </p>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full py-3 px-6 bg-zinc-900 dark:bg-zinc-50
                text-white dark:text-zinc-900
                rounded-lg font-semibold
                hover:bg-zinc-700 dark:hover:bg-zinc-200
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors"
            >
              {uploading ? 'Upload en cours...' : 'Uploader le template'}
            </button>
          </div>

          {message && (
            <div className="mt-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded text-sm">
              {message}
            </div>
          )}

          {/* Boutons éditeurs */}
          {templateList.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {pdfTemplates.length > 0 && (
                <div>
                  <a
                    href="/editor"
                    className="block w-full py-3 px-6 bg-blue-600 hover:bg-blue-700
                      text-white text-center rounded-lg font-semibold transition-colors"
                  >
                    📄 Éditeur PDF ({pdfTemplates.length})
                  </a>
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 text-center">
                    Définir les zones pour templates PDF
                  </p>
                </div>
              )}

              {htmlTemplates.length > 0 && (
                <div>
                  <a
                    href="/editor-html"
                    className="block w-full py-3 px-6 bg-purple-600 hover:bg-purple-700
                      text-white text-center rounded-lg font-semibold transition-colors"
                  >
                    🌐 Éditeur HTML ({htmlTemplates.length})
                  </a>
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 text-center">
                    Définir les variables pour templates HTML
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section API Info */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
            Utilisation des Webhooks pour n8n
          </h2>

          <div className="space-y-4 text-sm">
            {/* PDF Endpoints */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 rounded">
              <h3 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
                📄 Endpoints PDF:
              </h3>
              <div className="space-y-2">
                <div>
                  <code className="block bg-blue-100 dark:bg-blue-950 p-2 rounded text-xs overflow-x-auto">
                    POST /api/webhook/fill-pdf-custom
                  </code>
                  <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                    Pour PDFs avec zones personnalisées (défini via l&apos;éditeur)
                  </p>
                </div>
                <div>
                  <code className="block bg-blue-100 dark:bg-blue-950 p-2 rounded text-xs overflow-x-auto">
                    POST /api/webhook/fill-pdf
                  </code>
                  <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                    Pour PDFs avec formulaires intégrés
                  </p>
                </div>
              </div>
            </div>

            {/* HTML Endpoint */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-500 rounded">
              <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">
                🌐 Endpoint HTML:
              </h3>
              <code className="block bg-purple-100 dark:bg-purple-950 p-2 rounded text-xs overflow-x-auto">
                POST /api/webhook/fill-html
              </code>
              <p className="mt-2 text-xs text-purple-800 dark:text-purple-200">
                Pour templates HTML avec variables définies via l&apos;éditeur
              </p>
            </div>

            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded">
              <h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
                Exemple de body JSON (texte simple):
              </h3>
              <pre className="bg-zinc-200 dark:bg-zinc-900 p-3 rounded text-xs overflow-x-auto">
{`{
  "templateName": "mon-template.pdf",
  "fields": {
    "nom": "Dupont",
    "prenom": "Jean",
    "email": "jean@example.com"
  }
}`}
              </pre>
            </div>

            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded">
              <h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
                Exemple avec listes (pour factures HTML):
              </h3>
              <pre className="bg-zinc-200 dark:bg-zinc-900 p-3 rounded text-xs overflow-x-auto">
{`{
  "templateName": "facture.html",
  "fields": {
    "clientName": "Entreprise ABC",
    "items": [
      {
        "description": "Service A",
        "quantity": "2",
        "price": "100€"
      },
      {
        "description": "Service B",
        "quantity": "1",
        "price": "50€"
      }
    ]
  }
}`}
              </pre>
            </div>
          </div>

          {/* Liste des templates */}
          {templateList.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3 text-zinc-800 dark:text-zinc-200">
                Templates disponibles:
              </h3>

              {pdfTemplates.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">
                    PDF ({pdfTemplates.length}):
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {pdfTemplates.map((template) => (
                      <li key={template}>{template}</li>
                    ))}
                  </ul>
                </div>
              )}

              {htmlTemplates.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-2">
                    HTML ({htmlTemplates.length}):
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {htmlTemplates.map((template) => (
                      <li key={template}>{template}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
