# Usar imagen oficial de Node.js LTS
FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache bash

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY . .

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Cambiar ownership de archivos
RUN chown -R nodejs:nodejs /app
USER nodejs

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/ping', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Comando para iniciar la aplicación
CMD ["node", "index.js"]