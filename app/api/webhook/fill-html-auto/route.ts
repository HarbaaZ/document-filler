import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

interface FillHtmlRequest {
  templateName: string;
  fields: Record<string, string | number | boolean | Array<Record<string, any>>>;
  primaryColor?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FillHtmlRequest = await request.json();
    const { templateName, fields, primaryColor } = body;

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

    // Parser le HTML avec jsdom
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Calculer automatiquement les totaux si on a des prestations
    let calculatedTotalHT = 0;
    let calculatedTVA = 0;
    let calculatedTotalTTC = 0;

    if (fields.prestations && Array.isArray(fields.prestations)) {
      fields.prestations = fields.prestations.map((prestation: any) => {
        const quantity = parseFloat(String(prestation.quantity || prestation.quantite || 0).replace(/[^\d.-]/g, ''));
        const priceUnit = parseFloat(String(prestation.price || prestation.prix_unitaire || 0).replace(/[^\d.-]/g, ''));
        const tvaRate = parseFloat(String(prestation.tva || 0).replace(/[^\d.-]/g, '')) / 100;

        // Calculer le total HT pour cette ligne
        const totalHT = quantity * priceUnit;
        calculatedTotalHT += totalHT;

        // Retourner la prestation avec le total calculé
        return {
          ...prestation,
          total_ht: `${totalHT.toFixed(2)}€`
        };
      });

      // Calculer la TVA et le TTC
      calculatedTVA = calculatedTotalHT * (fields.tva_rate ? parseFloat(String(fields.tva_rate).replace(/[^\d.-]/g, '')) / 100 : 0.2);
      calculatedTotalTTC = calculatedTotalHT + calculatedTVA;

      // Mettre à jour les champs calculés
      fields.total_ht = `${calculatedTotalHT.toFixed(2)}€`;
      fields.tva = `${calculatedTVA.toFixed(2)}€`;
      fields.total_ttc = `${calculatedTotalTTC.toFixed(2)}€`;
    }

    // Remplir les champs
    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (fieldValue === undefined || fieldValue === null) {
        continue;
      }

      if (Array.isArray(fieldValue)) {
        // C'est une liste (tableau)
        // Chercher un tbody dans le document
        const tbody = document.querySelector('tbody');

        if (tbody) {
          // Trouver la première ligne TR dans le tbody (qui sert de template)
          const templateRow = tbody.querySelector('tr');

          if (templateRow) {
            // Vider le tbody
            tbody.innerHTML = '';

            // Créer une ligne pour chaque item
            fieldValue.forEach((item: Record<string, any>) => {
              const newRow = templateRow.cloneNode(true) as Element;
              const cells = newRow.querySelectorAll('td');

              // Remplir les cellules avec les valeurs de l'objet dans l'ordre
              const values = Object.values(item);
              cells.forEach((cell, index) => {
                if (values[index] !== undefined && values[index] !== null) {
                  cell.textContent = String(values[index]);
                }
              });

              tbody.appendChild(newRow);
            });
          }
        }
      } else {
        // Chercher un élément avec un ID, classe ou attribut data-field correspondant
        let element = document.getElementById(fieldName);

        if (!element) {
          element = document.querySelector(`.${fieldName}`);
        }

        if (!element) {
          element = document.querySelector(`[data-field="${fieldName}"]`);
        }

        if (element) {
          element.textContent = String(fieldValue);
        }
      }
    }

    // Appliquer la couleur primaire si fournie
    if (primaryColor) {
      const styleElement = document.querySelector('style');
      if (styleElement && styleElement.textContent) {
        // Remplacer la variable CSS --primary-color
        styleElement.textContent = styleElement.textContent.replace(
          /--primary-color:\s*#[0-9a-fA-F]{6};/,
          `--primary-color: ${primaryColor};`
        );
      }
    }

    // Générer le HTML rempli
    const filledHtml = dom.serialize();

    // Convertir en PDF avec Puppeteer
    // Configuration pour Netlify (serverless)
    // Détecter si on est dans un environnement serverless (Netlify, Vercel, etc.)
    const isServerless = process.env.NETLIFY === 'true' || 
                        process.env.VERCEL === '1' || 
                        process.env.NODE_ENV === 'production';

    const executablePath = isServerless 
      ? await chromium.executablePath()
      : undefined;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: isServerless 
        ? chromium.args
        : ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(filledHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();

    // Retourner le PDF
    const templateNameWithoutExt = templateName.replace('.html', '');
    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="facture_${templateNameWithoutExt}.pdf"`,
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
