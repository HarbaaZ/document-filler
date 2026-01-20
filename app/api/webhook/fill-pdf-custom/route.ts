import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';

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

interface TemplateZones {
  templateName: string;
  zones: Zone[];
}

interface FillPdfRequest {
  templateName: string;
  fields: Record<string, string | number | boolean>;
}

export async function POST(request: NextRequest) {
  try {
    const body: FillPdfRequest = await request.json();
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

    // Charger le PDF template
    const documentsPath = path.join(process.cwd(), 'documents');
    const templatePath = path.join(documentsPath, templateName);

    let pdfBytes: Buffer;
    try {
      pdfBytes = await readFile(templatePath);
    } catch (error) {
      return NextResponse.json(
        { error: `Template PDF introuvable: ${templateName}` },
        { status: 404 }
      );
    }

    // Charger les zones définies pour ce template
    const zonesPath = path.join(documentsPath, 'zones', `${templateName}.json`);
    let zones: Zone[] = [];

    try {
      const zonesData = await readFile(zonesPath, 'utf-8');
      const templateZones: TemplateZones = JSON.parse(zonesData);
      zones = templateZones.zones;
    } catch (error) {
      return NextResponse.json(
        { error: `Aucune zone définie pour le template ${templateName}. Utilisez l'éditeur pour définir les zones.` },
        { status: 400 }
      );
    }

    // Charger le PDF avec pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Remplir les zones avec les valeurs
    for (const zone of zones) {
      const fieldValue = fields[zone.name];
      if (fieldValue === undefined || fieldValue === null) {
        continue; // Skip si pas de valeur
      }

      const page = pdfDoc.getPage(zone.page - 1); // Les pages commencent à 0
      const pageHeight = page.getHeight();

      // Convertir les coordonnées (PDF a l'origine en bas à gauche)
      const yPosition = pageHeight - zone.y - zone.height;

      const text = String(fieldValue);
      const fontSize = zone.fontSize || 12;

      // Calculer la position du texte selon l'alignement
      let xPosition = zone.x + 2; // Petit padding

      if (zone.alignment === 'center') {
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        xPosition = zone.x + (zone.width - textWidth) / 2;
      } else if (zone.alignment === 'right') {
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        xPosition = zone.x + zone.width - textWidth - 2;
      }

      // Dessiner le texte
      page.drawText(text, {
        x: xPosition,
        y: yPosition + 2, // Petit padding vertical
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
      });
    }

    // Générer le PDF rempli
    const filledPdfBytes = await pdfDoc.save();

    // Retourner le PDF en tant que réponse
    return new NextResponse(Buffer.from(filledPdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="filled_${templateName}"`,
      },
    });

  } catch (error) {
    console.error('Erreur lors du remplissage du PDF:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors du remplissage du PDF',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
