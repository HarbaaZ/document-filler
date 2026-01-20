import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Sécurité: vérifier que le filename ne contient pas de path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Nom de fichier invalide' },
        { status: 400 }
      );
    }

    // Vérifier que c'est bien un PDF ou HTML
    const isPdf = filename.endsWith('.pdf');
    const isHtml = filename.endsWith('.html');

    if (!isPdf && !isHtml) {
      return NextResponse.json(
        { error: 'Seuls les fichiers PDF et HTML sont autorisés' },
        { status: 400 }
      );
    }

    const documentsPath = path.join(process.cwd(), 'documents');
    const filePath = path.join(documentsPath, filename);

    const fileBuffer = await readFile(filePath);

    const contentType = isPdf ? 'application/pdf' : 'text/html; charset=utf-8';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Erreur lors de la lecture du PDF:', error);
    return NextResponse.json(
      { error: 'Fichier non trouvé' },
      { status: 404 }
    );
  }
}
