import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

    // Uploader le PDF dans Cloudflare R2
    const templateNameWithoutExt = templateName.replace('.html', '');
    const timestamp = Date.now();
    const fileName = `factures/${templateNameWithoutExt}_${timestamp}.pdf`;
    
    // Configuration du client S3 pour R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });

    // Upload du PDF dans R2
    try {
      const uploadCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || '',
        Key: fileName,
        Body: Buffer.from(pdfBuffer),
        ContentType: 'application/pdf',
      });

      await s3Client.send(uploadCommand);

      // Construire l'URL publique du PDF
      // R2 nécessite soit un domaine personnalisé, soit un Worker pour exposer les fichiers publiquement
      // Si R2_PUBLIC_URL est défini, utilisez-le (domaine personnalisé ou Worker)
      // Sinon, utilisez l'URL publique R2 si disponible (format: https://pub-xxxxx.r2.dev)
      let publicUrl: string;
      
      if (process.env.R2_PUBLIC_URL) {
        // Domaine personnalisé ou Worker URL
        publicUrl = process.env.R2_PUBLIC_URL.endsWith('/')
          ? `${process.env.R2_PUBLIC_URL}${fileName}`
          : `${process.env.R2_PUBLIC_URL}/${fileName}`;
      } else if (process.env.R2_PUBLIC_DOMAIN) {
        // URL publique R2 directe (format: pub-xxxxx.r2.dev)
        publicUrl = `https://${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;
      } else {
        // Fallback: retourner le chemin relatif (nécessitera un Worker pour accéder)
        publicUrl = fileName;
      }

      // Retourner l'URL du PDF
      return NextResponse.json({
        success: true,
        pdfUrl: publicUrl,
        fileName: fileName,
        message: 'PDF généré et uploadé avec succès',
      }, {
        status: 200,
      });
    } catch (uploadError) {
      console.error('Erreur lors de l\'upload vers R2:', uploadError);
      // En cas d'erreur d'upload, retourner quand même le PDF en binaire
      return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="facture_${templateNameWithoutExt}.pdf"`,
        },
      });
    }

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
