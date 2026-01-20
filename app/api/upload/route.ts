import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    // Vérifier que c'est bien un PDF ou HTML
    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.html')) {
      return NextResponse.json(
        { error: 'Seuls les fichiers PDF et HTML sont acceptés' },
        { status: 400 }
      );
    }

    // Convertir le fichier en buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sauvegarder dans le dossier documents
    const documentsPath = path.join(process.cwd(), 'documents');
    const filePath = path.join(documentsPath, file.name);

    await writeFile(filePath, buffer);

    const fileType = file.name.endsWith('.pdf') ? 'PDF' : 'HTML';
    return NextResponse.json({
      success: true,
      message: `${fileType} uploadé avec succès`,
      filename: file.name,
      path: filePath
    });

  } catch (error) {
    console.error('Erreur lors de l\'upload:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'upload du fichier' },
      { status: 500 }
    );
  }
}

// Liste tous les PDFs et HTML disponibles
export async function GET() {
  try {
    const fs = require('fs/promises');
    const documentsPath = path.join(process.cwd(), 'documents');

    const files = await fs.readdir(documentsPath);
    const templateFiles = files.filter((file: string) =>
      file.endsWith('.pdf') || file.endsWith('.html')
    );

    return NextResponse.json({
      success: true,
      files: templateFiles
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des fichiers:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des fichiers' },
      { status: 500 }
    );
  }
}
