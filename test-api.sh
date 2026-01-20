#!/bin/bash

# Script de test pour l'API PDF Filler
# Assurez-vous que l'application est lancée avec: npm run dev

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "PDF Filler - Script de Test"
echo "=========================================="
echo ""

# Test 1: Lister les templates disponibles
echo "1. Liste des templates disponibles:"
curl -s "${BASE_URL}/api/upload" | jq '.'
echo ""
echo ""

# Test 2: Obtenir les champs d'un template (modifiez le nom du template)
TEMPLATE_NAME="formulaire.pdf"
echo "2. Champs du template '${TEMPLATE_NAME}':"
curl -s "${BASE_URL}/api/webhook/fill-pdf?template=${TEMPLATE_NAME}" | jq '.'
echo ""
echo ""

# Test 3: Remplir un PDF
echo "3. Remplissage d'un PDF:"
echo "Envoi de la requête..."

curl -X POST "${BASE_URL}/api/webhook/fill-pdf" \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "'"${TEMPLATE_NAME}"'",
    "fields": {
      "nom": "Dupont",
      "prenom": "Jean",
      "email": "jean.dupont@example.com",
      "telephone": "0123456789",
      "age": 30
    }
  }' \
  --output "filled_${TEMPLATE_NAME}"

if [ -f "filled_${TEMPLATE_NAME}" ]; then
  echo "✅ PDF rempli sauvegardé dans: filled_${TEMPLATE_NAME}"
  ls -lh "filled_${TEMPLATE_NAME}"
else
  echo "❌ Erreur: le PDF n'a pas été créé"
fi

echo ""
echo "=========================================="
echo "Tests terminés!"
echo "=========================================="
