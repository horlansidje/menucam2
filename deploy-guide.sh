#!/bin/bash
# ════════════════════════════════════════════
#  MenuCam — Script de préparation déploiement
# ════════════════════════════════════════════
echo "🍽️  MenuCam V3 — Préparation déploiement Railway"
echo "=================================================="

# Vérifier Node.js
echo ""
echo "📋 Vérification prérequis..."
node -v && echo "✅ Node.js OK" || echo "❌ Node.js manquant"
npm -v  && echo "✅ npm OK"     || echo "❌ npm manquant"
git -v  && echo "✅ Git OK"     || echo "❌ Git manquant"

# Vérifier que node_modules est dans .gitignore
echo ""
echo "📋 Vérification .gitignore..."
grep -q "node_modules" .gitignore && echo "✅ node_modules ignoré" || echo "❌ Ajoutez node_modules/ au .gitignore"

echo ""
echo "📦 Installation des dépendances..."
npm install

echo ""
echo "🔍 Test démarrage local..."
echo "   Pour tester : npm start"
echo "   Puis ouvrez : http://localhost:3000/health"

echo ""
echo "════════════════════════════════════"
echo "📤 Commandes Git pour Railway :"
echo "════════════════════════════════════"
echo ""
echo "  git init"
echo "  git add ."
echo '  git commit -m "feat: MenuCam V3 Railway ready"'
echo "  git remote add origin https://github.com/VOTRE_USERNAME/menucam.git"
echo "  git branch -M main"
echo "  git push -u origin main"
echo ""
echo "Puis sur railway.app → New Project → Deploy from GitHub"
echo ""
