'use client';

import { useState, useEffect, useRef } from 'react';

interface Variable {
  id: string;
  name: string;
  selector: string;
  type: 'text' | 'list';
  listFields?: string[]; // Pour les listes (ex: ["description", "quantity", "price"])
}

interface TemplateVariables {
  templateName: string;
  variables: Variable[];
}

export default function HtmlEditorPage() {
  const [htmlList, setHtmlList] = useState<string[]>([]);
  const [selectedHtml, setSelectedHtml] = useState<string>('');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [variables, setVariables] = useState<Variable[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    loadHtmlList();
  }, []);

  useEffect(() => {
    if (selectedHtml) {
      loadHtmlContent();
      loadVariables();
    }
  }, [selectedHtml]);

  const loadHtmlList = async () => {
    try {
      const response = await fetch('/api/upload');
      const data = await response.json();
      if (data.success) {
        const htmlFiles = data.files.filter((f: string) => f.endsWith('.html'));
        setHtmlList(htmlFiles);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la liste:', error);
    }
  };

  const loadHtmlContent = async () => {
    try {
      const response = await fetch(`/documents/${selectedHtml}`);
      const content = await response.text();
      setHtmlContent(content);
    } catch (error) {
      console.error('Erreur lors du chargement du HTML:', error);
    }
  };

  const loadVariables = async () => {
    try {
      const response = await fetch(`/api/html-variables?template=${selectedHtml}`);
      const data = await response.json();
      if (data.success) {
        setVariables(data.variables || []);
        setMessage('✅ Variables chargées');
        setTimeout(() => setMessage(''), 2000);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des variables:', error);
    }
  };

  const saveVariables = async () => {
    try {
      const response = await fetch('/api/html-variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: selectedHtml,
          variables: variables
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`✅ ${data.variablesCount} variable(s) sauvegardée(s)`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setMessage('❌ Erreur lors de la sauvegarde');
    }
  };

  const deleteVariable = (id: string) => {
    setVariables(variables.filter(v => v.id !== id));
    setSelectedVariable(null);
  };

  const generateSelector = (element: Element): string => {
    // Générer un sélecteur CSS unique pour l'élément
    if (element.id) {
      return `#${element.id}`;
    }

    const tagName = element.tagName.toLowerCase();
    const parent = element.parentElement;

    if (!parent) {
      return tagName;
    }

    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);

    if (index === -1) {
      return tagName;
    }

    const parentSelector = generateSelector(parent);
    return `${parentSelector} > ${tagName}:nth-child(${index + 1})`;
  };

  const handleIframeLoad = () => {
    if (!iframeRef.current?.contentDocument) return;

    const doc = iframeRef.current.contentDocument;

    // Ajouter un style pour le mode sélection
    const style = doc.createElement('style');
    style.textContent = `
      .html-editor-hover {
        outline: 2px solid #3b82f6 !important;
        background-color: rgba(59, 130, 246, 0.1) !important;
        cursor: pointer !important;
      }
      .html-editor-selected {
        outline: 3px solid #ef4444 !important;
        background-color: rgba(239, 68, 68, 0.2) !important;
      }
    `;
    doc.head.appendChild(style);

    if (isSelectMode) {
      // Ajouter les event listeners pour la sélection
      doc.body.addEventListener('mouseover', handleMouseOver);
      doc.body.addEventListener('mouseout', handleMouseOut);
      doc.body.addEventListener('click', handleElementClick);
    }
  };

  const handleMouseOver = (e: MouseEvent) => {
    if (!isSelectMode) return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'HTML' && target.tagName !== 'BODY') {
      target.classList.add('html-editor-hover');
    }
  };

  const handleMouseOut = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    target.classList.remove('html-editor-hover');
  };

  const handleElementClick = (e: MouseEvent) => {
    if (!isSelectMode) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    if (target.tagName === 'HTML' || target.tagName === 'BODY') return;

    const selector = generateSelector(target);
    const elementText = target.textContent?.trim() || '';

    const variableName = prompt('Nom de la variable:', elementText);
    if (!variableName) return;

    const isListItem = confirm('Est-ce un élément de liste répétable (pour facture, etc.) ?');

    if (isListItem) {
      const fieldsInput = prompt(
        'Champs de la liste (séparés par des virgules):\nEx: description,quantity,price',
        'description,quantity,price'
      );
      if (!fieldsInput) return;

      const listFields = fieldsInput.split(',').map(f => f.trim());

      const newVariable: Variable = {
        id: Date.now().toString(),
        name: variableName,
        selector: selector,
        type: 'list',
        listFields: listFields
      };

      setVariables([...variables, newVariable]);
    } else {
      const newVariable: Variable = {
        id: Date.now().toString(),
        name: variableName,
        selector: selector,
        type: 'text'
      };

      setVariables([...variables, newVariable]);
    }

    target.classList.remove('html-editor-hover');
    target.classList.add('html-editor-selected');
    setIsSelectMode(false);
  };

  useEffect(() => {
    if (iframeRef.current?.contentDocument) {
      handleIframeLoad();
    }
  }, [isSelectMode, htmlContent]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
          Éditeur de Variables HTML
        </h1>

        {/* Sélection du HTML */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
          <label className="block mb-2 font-semibold text-zinc-900 dark:text-zinc-50">
            Sélectionner un template HTML:
          </label>
          <select
            value={selectedHtml}
            onChange={(e) => {
              setSelectedHtml(e.target.value);
              setVariables([]);
            }}
            className="w-full p-2 border rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
          >
            <option value="">-- Choisir un HTML --</option>
            {htmlList.map(html => (
              <option key={html} value={html}>{html}</option>
            ))}
          </select>

          {selectedHtml && (
            <div className="mt-4 flex gap-4">
              <button
                onClick={() => setIsSelectMode(!isSelectMode)}
                className={`px-6 py-2 rounded ${
                  isSelectMode
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isSelectMode ? 'Annuler sélection' : 'Ajouter une variable'}
              </button>
              <button
                onClick={saveVariables}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Sauvegarder les variables
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

          {isSelectMode && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded border-2 border-blue-500">
              <p className="text-blue-900 dark:text-blue-100 font-semibold">
                Mode sélection activé
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Cliquez sur un élément dans le HTML pour créer une variable
              </p>
            </div>
          )}
        </div>

        {selectedHtml && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Aperçu HTML */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
                Aperçu du template
              </h2>
              <div className="border-2 border-zinc-300 dark:border-zinc-700 rounded overflow-auto max-h-[800px]">
                <iframe
                  ref={iframeRef}
                  srcDoc={htmlContent}
                  onLoad={handleIframeLoad}
                  className="w-full h-[800px] border-0"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            {/* Liste des variables */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
                Variables définies ({variables.length})
              </h2>

              {variables.length === 0 ? (
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                  Aucune variable définie. Cliquez sur "Ajouter une variable" puis sur un élément du HTML.
                </p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {variables.map(variable => (
                    <div
                      key={variable.id}
                      className={`p-3 border rounded cursor-pointer ${
                        selectedVariable === variable.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-zinc-300 dark:border-zinc-700'
                      }`}
                      onClick={() => setSelectedVariable(variable.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {variable.name}
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                            Type: {variable.type === 'list' ? 'Liste' : 'Texte'}
                          </div>
                          {variable.type === 'list' && variable.listFields && (
                            <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                              Champs: {variable.listFields.join(', ')}
                            </div>
                          )}
                          <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 font-mono break-all">
                            {variable.selector}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Supprimer la variable "${variable.name}" ?`)) {
                              deleteVariable(variable.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-800 font-bold ml-2"
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
