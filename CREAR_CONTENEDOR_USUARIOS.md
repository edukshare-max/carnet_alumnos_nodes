# 🗄️ Crear Contenedor de Usuarios en Azure Cosmos DB

## ✅ Estado Actual

Ya hemos implementado todo el código del sistema de autenticación:

- ✅ Frontend: Pantallas de registro y login
- ✅ Backend: Endpoints `/auth/register` y `/auth/login` actualizados
- ✅ Base de datos: Funciones para manejar usuarios

**Falta un solo paso:** Crear el contenedor `usuarios` en Azure Cosmos DB.

---

## 📋 Pasos para Crear el Contenedor

### Opción 1: Desde Azure Portal (Recomendado)

1. **Acceder a Azure Portal**
   - Ve a: https://portal.azure.com
   - Inicia sesión con tu cuenta de Azure

2. **Navegar a tu Cosmos DB Account**
   - Busca "Cosmos DB" en la barra de búsqueda
   - Selecciona tu cuenta (probablemente se llama algo como `sasu-cosmos-db` o similar)

3. **Crear Nuevo Contenedor**
   - En el menú lateral, haz clic en **"Data Explorer"**
   - Busca tu base de datos **"SASU"**
   - Haz clic en los **tres puntos (...)** junto a la base de datos
   - Selecciona **"New Container"**

4. **Configurar el Contenedor**
   ```
   Database id: SASU (seleccionar existente)
   Container id: usuarios
   Partition key: /matricula
   Throughput: Manual (400 RU/s - mínimo)
   ```

5. **Crear**
   - Haz clic en **"OK"** o **"Create"**
   - El contenedor se creará en unos segundos

### Opción 2: Desde Azure CLI

Si tienes Azure CLI instalado:

```bash
# Configurar variables
RESOURCE_GROUP="tu-resource-group"
ACCOUNT_NAME="tu-cosmos-account"
DATABASE_NAME="SASU"
CONTAINER_NAME="usuarios"

# Crear contenedor
az cosmosdb sql container create \
  --resource-group $RESOURCE_GROUP \
  --account-name $ACCOUNT_NAME \
  --database-name $DATABASE_NAME \
  --name $CONTAINER_NAME \
  --partition-key-path "/matricula" \
  --throughput 400
```

---

## 📊 Esquema del Documento Usuario

Cada documento en el contenedor `usuarios` tendrá esta estructura:

```json
{
  "id": "15662",                    // Igual que matrícula
  "matricula": "15662",              // Partition key
  "correo": "15662@uagro.mx",
  "passwordHash": "$2a$10$...",     // Hash bcrypt
  "createdAt": "2025-10-12T10:30:00.000Z",
  "updatedAt": "2025-10-12T10:30:00.000Z"
}
```

### 🔐 Importante sobre Partition Key

**¿Por qué `/matricula` como partition key?**

- ✅ **Distribución uniforme**: Cada alumno tiene una matrícula única
- ✅ **Queries eficientes**: Todas las consultas son por matrícula
- ✅ **Escalabilidad**: Azure puede distribuir usuarios entre particiones físicas
- ✅ **Costo-efectivo**: No hay cross-partition queries

---

## ✅ Verificar que Funciona

Una vez creado el contenedor, el backend se conectará automáticamente. Puedes verificar en los logs:

```
📦 Contenedor usuarios: usuarios
```

Si el contenedor no existe, verás:

```
⚠️ Contenedor usuarios no existe. Se necesita crear manualmente en Azure Portal.
```

---

## 🚀 Siguiente Paso

Una vez creado el contenedor:

1. **Instalar dependencias del backend**:
   ```bash
   cd carnet_alumnos_nodes
   npm install
   ```

2. **Hacer push a GitHub**:
   ```bash
   git push origin main
   ```

3. **Render detectará los cambios** y hará redeploy automático con:
   - Nueva dependencia `bcryptjs`
   - Nuevos endpoints `/auth/register` y `/auth/login` actualizados
   - Conexión al nuevo contenedor `usuarios`

4. **Probar el sistema completo** desde el frontend en localhost:8080

---

## 📝 Notas Adicionales

### Throughput (RU/s)

- **400 RU/s**: Mínimo permitido (~$24 USD/mes)
- Para un carnet digital universitario, 400 RU/s es suficiente para cientos de usuarios concurrentes
- Si necesitas más, puedes escalar desde Azure Portal

### Índices Automáticos

Cosmos DB crea automáticamente índices para:
- `/id`
- `/matricula` (partition key)
- Todos los campos por defecto

Para búsquedas por correo, el índice automático es suficiente.

### Seguridad

- ❌ **Nunca** guardes contraseñas en texto plano
- ✅ Usamos `bcryptjs` con 10 salt rounds
- ✅ JWT con expiración de 7 días
- ✅ Validación de correo+matrícula contra base de carnets

---

## 🆘 Troubleshooting

### Error: "Container not found"

El backend puede arrancar sin el contenedor `usuarios`, pero los endpoints de registro/login fallarán. Solo necesitas crear el contenedor y el sistema funcionará.

### Error: "Insufficient throughput"

Si ves errores 429 (Too Many Requests), necesitas aumentar los RU/s del contenedor desde Azure Portal.

### Error: "Invalid partition key"

Asegúrate de que el partition key es exactamente `/matricula` (con el slash `/` al inicio).
