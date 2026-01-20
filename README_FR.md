# PDF Filler - Application de Remplissage de Formulaires PDF

Application Next.js pour uploader des templates PDF et les remplir via webhook pour n8n.

## Fonctionnalités

- Upload de templates PDF dans le dossier `documents/`
- **✨ Éditeur visuel de zones** : Définissez visuellement les zones à remplir sur vos PDFs
- Webhook API pour remplir les PDFs avec des variables (formulaires classiques)
- Webhook API pour remplir les PDFs avec zones personnalisées
- Interface web pour gérer les templates
- Compatible avec n8n pour l'automatisation

## Installation

```bash
npm install
```

## Lancement

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## Structure du Projet

```
pdf-filler/
├── documents/           # Dossier contenant les templates PDF
│   └── zones/          # Définitions de zones pour chaque template
├── app/
│   ├── api/
│   │   ├── upload/     # API pour uploader les PDFs
│   │   ├── zones/      # API pour gérer les zones personnalisées
│   │   └── webhook/
│   │       ├── fill-pdf/        # Webhook pour formulaires PDF classiques
│   │       └── fill-pdf-custom/ # Webhook pour zones personnalisées
│   ├── editor/         # Éditeur visuel de zones
│   └── page.tsx        # Interface utilisateur
```

## Utilisation

### 1. Uploader un Template PDF

Via l'interface web:
- Accédez à [http://localhost:3000](http://localhost:3000)
- Sélectionnez votre fichier PDF template
- Cliquez sur "Uploader le PDF"

### 2. Définir les Zones à Remplir (Nouveau!)

Pour les PDFs sans champs de formulaire intégrés :
- Après l'upload, cliquez sur "✏️ Ouvrir l'éditeur de zones"
- Sélectionnez votre template PDF dans la liste
- **Dessinez les zones** : Cliquez et glissez sur le PDF pour créer une zone
- Nommez chaque zone (ex: "nom", "prenom", "date")
- Cliquez sur "Sauvegarder les zones"

💡 **Astuce** : Les zones définies sont sauvegardées dans `documents/zones/[nom-du-template].json`

Via l'API:
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@mon-template.pdf"
```

### 3. Lister les Templates Disponibles

```bash
curl http://localhost:3000/api/upload
```

Réponse:
```json
{
  "success": true,
  "files": ["formulaire.pdf", "contrat.pdf"]
}
```

### 4. Voir les Champs/Zones d'un Template

**Pour les formulaires PDF classiques** :
```bash
curl "http://localhost:3000/api/webhook/fill-pdf?template=mon-template.pdf"
```

**Pour les zones personnalisées** :
```bash
curl "http://localhost:3000/api/zones?template=mon-template.pdf"
```

### 5. Remplir un PDF (Webhook pour n8n)

#### Option A: Avec Zones Personnalisées (Recommandé)

Pour les PDFs où vous avez défini des zones via l'éditeur :

```bash
curl -X POST http://localhost:3000/api/webhook/fill-pdf-custom \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "mon-template.pdf",
    "fields": {
      "nom": "Dupont",
      "prenom": "Jean",
      "email": "jean@example.com",
      "date": "2026-01-19"
    }
  }' \
  --output filled_document.pdf
```

#### Option B: Avec Formulaires PDF Classiques

```bash
curl -X POST http://localhost:3000/api/webhook/fill-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "mon-template.pdf",
    "fields": {
      "nom": "Dupont",
      "prenom": "Jean",
      "email": "jean@example.com",
      "age": 30,
      "accepte": true
    }
  }' \
  --output filled_document.pdf
```

Le PDF rempli sera retourné en tant que fichier binaire.

## Configuration dans n8n

### Workflow n8n Exemple - Zones Personnalisées

1. **Trigger**: Webhook ou autre source de données

2. **Node HTTP Request**:
   - **Method**: POST
   - **URL**: `http://localhost:3000/api/webhook/fill-pdf-custom` ⭐ (Nouveau)
   - **Body Content Type**: JSON
   - **Body**:
   ```json
   {
     "templateName": "{{ $json.template }}",
     "fields": {
       "nom": "{{ $json.nom }}",
       "prenom": "{{ $json.prenom }}",
       "email": "{{ $json.email }}"
     }
   }
   ```
   - **Response Format**: File
   - **Download File**: Activé

3. **Node suivant**: Utiliser le PDF retourné (envoi par email, stockage, etc.)

💡 **Note** : Pour les formulaires PDF classiques, utilisez `/api/webhook/fill-pdf` au lieu de `/api/webhook/fill-pdf-custom`

### Exemple Complet n8n

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "fill-pdf",
        "responseMode": "lastNode"
      }
    },
    {
      "name": "Fill PDF",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/api/webhook/fill-pdf",
        "options": {
          "response": {
            "response": {
              "responseFormat": "file"
            }
          }
        },
        "sendBody": true,
        "bodyContentType": "json",
        "bodyParametersJson": "={{ {\n  \"templateName\": $json.template,\n  \"fields\": $json.fields\n} }}"
      }
    }
  ]
}
```

## Types de Champs Supportés

- **PDFTextField**: Champs texte standard
- **PDFCheckBox**: Cases à cocher (valeurs: `true`, `false`, `"true"`, `"false"`, `1`, `0`)
- **PDFDropdown**: Listes déroulantes
- **PDFRadioGroup**: Boutons radio

## Exemple de Template PDF

Pour créer un template PDF compatible:

1. Utilisez Adobe Acrobat ou LibreOffice pour créer votre formulaire
2. Ajoutez des champs de formulaire avec des noms uniques
3. Sauvegardez le PDF
4. Uploadez-le via l'interface

## Gestion des Erreurs

L'API retourne des codes HTTP appropriés:

- **200**: Succès, PDF rempli retourné
- **400**: Paramètres manquants ou invalides
- **404**: Template PDF non trouvé
- **500**: Erreur serveur

## Sécurité

Pour la production, ajoutez:

1. **Authentification**: Protégez les endpoints avec des tokens API
2. **Validation**: Validez les noms de fichiers pour éviter les path traversal
3. **Limite de taille**: Limitez la taille des uploads
4. **Rate limiting**: Limitez le nombre de requêtes

## Déploiement

### Variables d'Environnement

Créez un fichier `.env.local`:

```env
# Optionnel: Clé API pour sécuriser les webhooks
API_KEY=votre_cle_secrete
```

### Déploiement sur Vercel

```bash
npm run build
vercel deploy
```

Note: Assurez-vous que le dossier `documents/` est accessible en production (utiliser un stockage externe comme S3 si nécessaire).

## Développement

```bash
# Mode développement
npm run dev

# Build production
npm run build

# Démarrer en production
npm start
```

## Dépannage

### Le PDF n'est pas rempli correctement

- Vérifiez les noms des champs avec `GET /api/webhook/fill-pdf?template=...`
- Assurez-vous que les noms de champs correspondent exactement

### Erreur "Template PDF introuvable"

- Vérifiez que le fichier existe dans le dossier `documents/`
- Vérifiez l'orthographe du nom de fichier (sensible à la casse)

### Le PDF retourné est vide

- Assurez-vous que votre template PDF contient bien des champs de formulaire
- Testez avec un PDF créé avec Adobe Acrobat ou LibreOffice

## Support

Pour toute question ou problème, ouvrez une issue sur GitHub.
