#!/bin/bash
# Script de build para Render
set -e

echo "🔧 Iniciando build del backend Node.js..."

# Verificar Node.js
node --version
npm --version

# Limpiar caché npm
npm cache clean --force

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm ci --only=production

echo "✅ Build completado exitosamente"