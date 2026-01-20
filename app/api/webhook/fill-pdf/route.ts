import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';

interface FillPdfRequest {
  templateName: string; // Nom du fichier PDF template dans /documents
  fields: Record<string, string | number | boolean>; // Variables à remplir { "nom": "John", "prenom": "Doe", etc. }
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

    // Charger le PDF avec pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // Remplir les champs du formulaire PDF
    Object.entries(fields).forEach(([fieldName, value]) => {
      try {
        const field = form.getField(fieldName);

        // Gérer différents types de champs
        if (field.constructor.name === 'PDFTextField') {
          const textField = form.getTextField(fieldName);
          textField.setText(String(value));
        } else if (field.constructor.name === 'PDFCheckBox') {
          const checkbox = form.getCheckBox(fieldName);
          const boolValue = value === true || value === 'true' || value === '1' || value === 1;
          if (boolValue) {
            checkbox.check();
          } else {
            checkbox.uncheck();
          }
        } else if (field.constructor.name === 'PDFDropdown') {
          const dropdown = form.getDropdown(fieldName);
          dropdown.select(String(value));
        } else if (field.constructor.name === 'PDFRadioGroup') {
          const radioGroup = form.getRadioGroup(fieldName);
          radioGroup.select(String(value));
        }
      } catch (error) {
        console.warn(`Impossible de remplir le champ "${fieldName}":`, error);
        // On continue même si un champ n'existe pas
      }
    });

    // Aplatir le formulaire (optionnel - rend les champs non-éditables)
    // form.flatten();

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

// Route GET pour obtenir les champs disponibles d'un template PDF
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const templateName = searchParams.get('template');

    if (!templateName) {
      return NextResponse.json(
        { error: 'Le paramètre template est requis' },
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

    // Charger le PDF avec pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    // Extraire les informations des champs
    const fieldInfo = fields.map(field => ({
      name: field.getName(),
      type: field.constructor.name,
    }));

    return NextResponse.json({
      success: true,
      template: templateName,
      fields: fieldInfo
    });

  } catch (error) {
    console.error('Erreur lors de la lecture du PDF:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors de la lecture du PDF',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
