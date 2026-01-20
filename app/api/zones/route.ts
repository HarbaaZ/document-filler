import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import path from 'path';

export interface Zone {
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

export interface TemplateZones {
  templateName: string;
  zones: Zone[];
}

// GET: Récupérer les zones d'un template
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

    const zonesPath = path.join(process.cwd(), 'documents', 'zones', `${templateName}.json`);

    try {
      const zonesData = await readFile(zonesPath, 'utf-8');
      const zones: TemplateZones = JSON.parse(zonesData);

      return NextResponse.json({
        success: true,
        zones: zones.zones
      });
    } catch (error) {
      // Si le fichier n'existe pas, retourner un tableau vide
      return NextResponse.json({
        success: true,
        zones: []
      });
    }

  } catch (error) {
    console.error('Erreur lors de la récupération des zones:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des zones' },
      { status: 500 }
    );
  }
}

// POST: Sauvegarder les zones d'un template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateName, zones } = body as TemplateZones;

    if (!templateName) {
      return NextResponse.json(
        { error: 'Le nom du template est requis' },
        { status: 400 }
      );
    }

    if (!zones || !Array.isArray(zones)) {
      return NextResponse.json(
        { error: 'Les zones sont requises et doivent être un tableau' },
        { status: 400 }
      );
    }

    const zonesPath = path.join(process.cwd(), 'documents', 'zones', `${templateName}.json`);
    const zonesData: TemplateZones = {
      templateName,
      zones
    };

    await writeFile(zonesPath, JSON.stringify(zonesData, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Zones sauvegardées avec succès',
      zonesCount: zones.length
    });

  } catch (error) {
    console.error('Erreur lors de la sauvegarde des zones:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde des zones' },
      { status: 500 }
    );
  }
}
