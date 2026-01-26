# Configuration Cloudflare R2

Ce document explique comment configurer Cloudflare R2 pour stocker les PDFs générés.

## Variables d'environnement requises

Ajoutez ces variables dans votre fichier `.env` (local) ou dans les paramètres d'environnement de Netlify :

```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name

# Optionnel: Endpoint personnalisé
# R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com

# Optionnel: URL publique (domaine personnalisé ou Worker)
# R2_PUBLIC_URL=https://your-custom-domain.com
# OU
# R2_PUBLIC_DOMAIN=pub-xxxxx.r2.dev
```

## Comment obtenir les credentials R2

1. **Connectez-vous à Cloudflare Dashboard**
2. **Allez dans R2 Object Storage**
3. **Créez un bucket** (si ce n'est pas déjà fait)
4. **Allez dans "Manage R2 API Tokens"**
5. **Créez un nouveau token API** avec les permissions de lecture/écriture
6. **Copiez les credentials** :
   - `Account ID` → `R2_ACCOUNT_ID`
   - `Access Key ID` → `R2_ACCESS_KEY_ID`
   - `Secret Access Key` → `R2_SECRET_ACCESS_KEY`
   - Nom du bucket → `R2_BUCKET_NAME`

## Configuration de l'URL publique

Cloudflare R2 nécessite une configuration supplémentaire pour exposer les fichiers publiquement. Vous avez deux options :

### Option 1 : Domaine personnalisé (recommandé)

1. Dans votre bucket R2, allez dans "Settings" → "Public Access"
2. Configurez un domaine personnalisé (ex: `cdn.example.com`)
3. Ajoutez `R2_PUBLIC_URL=https://cdn.example.com` dans vos variables d'environnement

### Option 2 : Worker R2 (pour développement)

Créez un Worker Cloudflare qui expose les fichiers R2 :

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // Enlever le premier /
    
    const object = await env.MY_BUCKET.get(key);
    
    if (object === null) {
      return new Response('Object Not Found', { status: 404 });
    }
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    return new Response(object.body, { headers });
  }
};
```

Puis ajoutez `R2_PUBLIC_URL=https://your-worker.your-subdomain.workers.dev` dans vos variables d'environnement.

### Option 3 : URL publique R2 directe

Si votre bucket a une URL publique R2 (format `pub-xxxxx.r2.dev`), vous pouvez utiliser :
```env
R2_PUBLIC_DOMAIN=pub-xxxxx.r2.dev
```

## Format de réponse de l'API

L'API `/api/webhook/fill-html-auto` retourne maintenant un JSON au lieu du PDF binaire :

```json
{
  "success": true,
  "pdfUrl": "https://cdn.example.com/factures/facture_template_1234567890.pdf",
  "fileName": "factures/facture_template_1234567890.pdf",
  "message": "PDF généré et uploadé avec succès"
}
```

En cas d'erreur d'upload vers R2, l'API retourne le PDF en binaire (comportement de fallback).
