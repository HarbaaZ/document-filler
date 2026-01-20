import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

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

// GET: Récupérer les variables pour un template
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const templateName = searchParams.get('template');

    if (!templateName) {
      return NextResponse.json(
        { error: 'Le nom du template est requis' },
        { status: 400 }
      );
    }

    const variablesPath = path.join(
      process.cwd(),
      'documents',
      'variables',
      `${templateName}.json`
    );

    try {
      const data = await readFile(variablesPath, 'utf-8');
      const templateVariables: TemplateVariables = JSON.parse(data);

      return NextResponse.json({
        success: true,
        variables: templateVariables.variables
      });
    } catch (error) {
      // Fichier n'existe pas encore
      return NextResponse.json({
        success: true,
        variables: []
      });
    }

  } catch (error) {
    console.error('Erreur lors de la récupération des variables:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des variables' },
      { status: 500 }
    );
  }
}

// POST: Sauvegarder les variables pour un template
export async function POST(request: NextRequest) {
  try {
    const body: TemplateVariables = await request.json();
    const { templateName, variables } = body;

    if (!templateName) {
      return NextResponse.json(
        { error: 'Le nom du template est requis' },
        { status: 400 }
      );
    }

    // Créer le dossier variables s'il n'existe pas
    const variablesDir = path.join(process.cwd(), 'documents', 'variables');
    try {
      await mkdir(variablesDir, { recursive: true });
    } catch (error) {
      // Le dossier existe déjà
    }

    const variablesPath = path.join(variablesDir, `${templateName}.json`);

    const templateVariables: TemplateVariables = {
      templateName,
      variables
    };

    await writeFile(
      variablesPath,
      JSON.stringify(templateVariables, null, 2),
      'utf-8'
    );

    return NextResponse.json({
      success: true,
      message: 'Variables sauvegardées avec succès',
      variablesCount: variables.length
    });

  } catch (error) {
    console.error('Erreur lors de la sauvegarde des variables:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde des variables' },
      { status: 500 }
    );
  }
}
