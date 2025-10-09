# 📝 Resumen de Integración: Promociones con Cosmos DB

## ✅ Lo que se hizo

Se integró el endpoint de **promociones** con **Azure Cosmos DB** en el backend existente de Render.

---

## 🔧 Cambios Técnicos

### 1. **config/database.js**
- ✅ Agregada variable `promocionesContainer` para conectar al contenedor `promociones_salud`
- ✅ Agregada función `findPromocionesByMatricula(matricula)` que:
  - Lee promociones del contenedor de Cosmos DB
  - Filtra por `autorizado = true`
  - Retorna promociones para matrícula específica O para todos (`matricula = null`)
- ✅ Agregada función `registrarClickPromocion(promocionId, matricula)` para estadísticas
- ✅ Se verifica la conexión al contenedor al iniciar el servidor

### 2. **routes/promociones.js**
- ✅ Eliminados datos temporales en memoria (array `promocionesDB`)
- ✅ Actualizado `GET /promociones/activas` para leer de Cosmos DB
- ✅ Agregado endpoint `POST /promociones/:id/click` para registrar estadísticas
- ✅ Eliminados endpoints de creación/eliminación (se hace desde app admin)

### 3. **.env.example**
- ✅ Agregada variable `COSMOS_CONTAINER_PROMOCIONES=promociones_salud`

---

## 📊 Estructura de Datos

### Documento en Cosmos DB (`promociones_salud`):
```json
{
  "id": "promocion:123e4567-e89b-12d3-a456-426614174000",
  "link": "https://salud.uagro.mx/vacunacion",
  "departamento": "SALUD",
  "categoria": "vacunacion",
  "programa": "Campaña de Vacunación Influenza 2024",
  "matricula": "15662",
  "destinatario": "alumno",
  "autorizado": true,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "createdBy": "admin@uagro.mx"
}
```

### Respuesta del API (`GET /promociones/activas`):
```json
{
  "success": true,
  "data": [
    {
      "id": "promocion:123e4567-e89b-12d3-a456-426614174000",
      "link": "https://salud.uagro.mx/vacunacion",
      "departamento": "SALUD",
      "categoria": "vacunacion",
      "programa": "Campaña de Vacunación Influenza 2024",
      "matricula": "15662",
      "destinatario": "alumno",
      "autorizado": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "createdBy": "admin@uagro.mx"
    }
  ],
  "count": 1
}
```

---

## 🌐 Endpoints Disponibles

### 1. GET /promociones/activas
**Descripción:** Obtiene promociones activas para el usuario autenticado

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Respuesta:**
```json
{
  "success": true,
  "data": [...],
  "count": 3
}
```

### 2. POST /promociones/:id/click
**Descripción:** Registra cuando un usuario hace click en una promoción

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Click registrado"
}
```

---

## 🔍 Lógica de Filtrado

La función `findPromocionesByMatricula()` retorna promociones que cumplan:

```sql
SELECT * FROM c 
WHERE c.autorizado = true 
AND (
  c.matricula = @matricula  -- Promoción específica para esta matrícula
  OR 
  NOT IS_DEFINED(c.matricula)  -- Campo matricula no existe
  OR 
  c.matricula = null  -- Campo matricula es null
)
ORDER BY c.createdAt DESC
```

### Ejemplos:

| Matrícula del usuario | Matricula en documento | ¿Se muestra? |
|----------------------|------------------------|--------------|
| "15662"              | "15662"                | ✅ Sí        |
| "15662"              | null                   | ✅ Sí        |
| "15662"              | undefined              | ✅ Sí        |
| "15662"              | "15663"                | ❌ No        |
| "99999"              | null                   | ✅ Sí        |

---

## 📦 Variables de Entorno Necesarias

Estas variables deben estar configuradas en Render:

```bash
# Azure Cosmos DB
COSMOS_ENDPOINT=https://sasuuagro.documents.azure.com:443/
COSMOS_KEY=<tu_clave_secreta>
COSMOS_DATABASE=SASU
COSMOS_CONTAINER_CARNETS=carnets_id
COSMOS_CONTAINER_CITAS=cita_id
COSMOS_CONTAINER_PROMOCIONES=promociones_salud  # ⬅️ NUEVA

# JWT
JWT_SECRET=<tu_jwt_secret>
JWT_EXPIRES_IN=7d

# Otros
NODE_ENV=production
CORS_ORIGINS=http://localhost:3000,https://carnet-alumnos-nodes.onrender.com,https://app.carnetdigital.space
```

---

## 🚀 Flujo Completo

```
┌─────────────────┐
│  App Admin      │
│  (CRES_Carnets) │
└────────┬────────┘
         │
         │ 1. Crea promoción
         ▼
┌─────────────────┐
│  Cosmos DB      │
│  promociones    │
│  _salud         │
└────────┬────────┘
         │
         │ 2. Lee promociones
         ▼
┌─────────────────┐
│  Backend Render │
│  /promociones   │
│  /activas       │
└────────┬────────┘
         │
         │ 3. Consume API
         ▼
┌─────────────────┐
│  Flutter App    │
│  Carnets        │
└─────────────────┘
```

---

## ✅ Testing

### Paso 1: Verificar conexión en logs de Render
```
✅ Conexión a Azure Cosmos DB establecida
📦 Contenedor carnets: carnets_id
📦 Contenedor citas: cita_id
📦 Contenedor promociones: promociones_salud  ⬅️ Debe aparecer
🚀 Servidor corriendo en puerto 3000
```

### Paso 2: Probar endpoint con Postman/cURL
```bash
curl -X GET \
  https://carnet-alumnos-nodes.onrender.com/promociones/activas \
  -H 'Authorization: Bearer <tu_token_jwt>'
```

### Paso 3: Verificar en Flutter
- Iniciar sesión en la app
- Ver sección de "Promociones de Salud"
- Las promociones deben aparecer automáticamente

---

## 🎯 Próximos Pasos

1. ✅ **Configurar variable en Render** (`COSMOS_CONTAINER_PROMOCIONES`)
2. ✅ **Esperar despliegue automático** (2-3 minutos)
3. ✅ **Verificar logs** en Render
4. ✅ **Probar endpoint** con Postman
5. ✅ **Verificar en Flutter app**

---

## 📞 Soporte

Si hay problemas:
1. Revisa los logs de Render
2. Verifica que todas las variables de entorno estén configuradas
3. Verifica que exista el contenedor `promociones_salud` en Cosmos DB
4. Verifica que haya al menos una promoción con `autorizado: true`

---

## 🎉 Estado: ✅ LISTO PARA PRODUCCIÓN

El código ha sido:
- ✅ Desarrollado
- ✅ Testeado localmente
- ✅ Committeado a GitHub
- ✅ Pusheado a repositorio
- ⏳ Pendiente: Configurar variable en Render y verificar despliegue
