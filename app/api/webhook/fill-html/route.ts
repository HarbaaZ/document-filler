import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';

interface Variable {
  id: string;
  name: string;
  selector: string;
  type: 'text' | 'list';
  listFields?: string[];
}

interface TemplateVariables {
  templateName: string;
  variables: Variable[];
}

interface FillHtmlRequest {
  templateName: string;
  fields: Record<string, string | number | boolean | Array<Record<string, any>>>;
}

export async function POST(request: NextRequest) {
  try {
    const body: FillHtmlRequest = await request.json();
    const { templateName, fields } = body;

    if (!templateName) {
      return NextResponse.json(
        { error: 'Le nom du template est requis' },
        { status: 400 }
      );
    }

    if (!fields || Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: 'Les champs à remplir sont requis' },
        { status: 400 }
      );
    }

    // Charger le template HTML
    const documentsPath = path.join(process.cwd(), 'documents');
    const templatePath = path.join(documentsPath, templateName);

    let htmlContent: string;
    try {
      htmlContent = await readFile(templatePath, 'utf-8');
    } catch (error) {
      return NextResponse.json(
        { error: `Template HTML introuvable: ${templateName}` },
        { status: 404 }
      );
    }

    // Charger les variables définies pour ce template
    const variablesPath = path.join(documentsPath, 'variables', `${templateName}.json`);
    let variables: Variable[] = [];

    try {
      const variablesData = await readFile(variablesPath, 'utf-8');
      const templateVariables: TemplateVariables = JSON.parse(variablesData);
      variables = templateVariables.variables;
    } catch (error) {
      return NextResponse.json(
        { error: `Aucune variable définie pour le template ${templateName}. Utilisez l'éditeur pour définir les variables.` },
        { status: 400 }
      );
    }

    // Parser le HTML avec jsdom
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Remplir les variables
    for (const variable of variables) {
      const fieldValue = fields[variable.name];
      if (fieldValue === undefined || fieldValue === null) {
        continue; // Skip si pas de valeur
      }

      if (variable.type === 'text') {
        // Variable simple
        const element = document.querySelector(variable.selector);
        if (element) {
          element.textContent = String(fieldValue);
        }
      } else if (variable.type === 'list' && Array.isArray(fieldValue)) {
        // Variable de type liste (pour les factures, etc.)
        const templateElement = document.querySelector(variable.selector);
        if (!templateElement) continue;

        const parent = templateElement.parentElement;
        if (!parent) continue;

        // Cloner l'élément template pour chaque item de la liste
        const templateClone = templateElement.cloneNode(true) as Element;

        // Supprimer l'élément original
        templateElement.remove();

        // Créer un élément pour chaque item
        fieldValue.forEach((item: Record<string, any>) => {
          const newElement = templateClone.cloneNode(true) as Element;

          // Remplir les champs de la liste
          if (variable.listFields) {
            variable.listFields.forEach((field, index) => {
              const value = item[field];
              if (value !== undefined && value !== null) {
                // Chercher un élément dans le clone qui pourrait contenir ce champ
                // Méthode 1: chercher un élément avec data-field="fieldname"
                let fieldElement = newElement.querySelector(`[data-field="${field}"]`);

                // Méthode 2: chercher par classe .fieldname
                if (!fieldElement) {
                  fieldElement = newElement.querySelector(`.${field}`);
                }

                // Méthode 3: Pour les tableaux TR, utiliser l'index des TD
                if (!fieldElement && newElement.tagName === 'TR') {
                  const cells = newElement.querySelectorAll('td');
                  if (cells[index]) {
                    fieldElement = cells[index];
                  }
                }

                if (fieldElement) {
                  fieldElement.textContent = String(value);
                }
              }
            });
          }

          parent.appendChild(newElement);
        });
      }
    }

    // Retourner le HTML rempli
    const filledHtml = dom.serialize();

    return new NextResponse(filledHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="filled_${templateName}"`,
      },
    });

  } catch (error) {
    console.error('Erreur lors du remplissage du HTML:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors du remplissage du HTML',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
