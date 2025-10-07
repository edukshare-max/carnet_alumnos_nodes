#!/bin/bash
# Script de inicio para Render
set -e

echo "🚀 Iniciando servidor Node.js..."

# Verificar variables de entorno críticas
if [ -z "$COSMOS_ENDPOINT" ]; then
    echo "❌ Error: COSMOS_ENDPOINT no configurado"
    exit 1
fi

if [ -z "$COSMOS_KEY" ]; then
    echo "❌ Error: COSMOS_KEY no configurado"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ Error: JWT_SECRET no configurado"
    exit 1
fi

echo "✅ Variables de entorno verificadas"
echo "🌍 Entorno: ${NODE_ENV:-development}"
echo "🔌 Puerto: ${PORT:-3000}"

# Iniciar servidor
exec node index.js