# ✅ CHECKLIST RÁPIDO - Activar Promociones en Render

## 🎯 Solo necesitas hacer esto:

### 1️⃣ Entrar a Render Dashboard
- [ ] Ir a: https://dashboard.render.com
- [ ] Iniciar sesión
- [ ] Buscar servicio: **carnet-alumnos-nodes**

### 2️⃣ Agregar Variable de Entorno
- [ ] Click en tu servicio **carnet-alumnos-nodes**
- [ ] Click en **"Environment"** en el menú lateral izquierdo
- [ ] Buscar si ya existe `COSMOS_CONTAINER_PROMOCIONES`
  - Si NO existe: Click en **"Add Environment Variable"**
  - Si SÍ existe: Verificar que tenga el valor correcto

### 3️⃣ Configurar la Variable
```
Key:   COSMOS_CONTAINER_PROMOCIONES
Value: promociones_salud
```
- [ ] Click en **"Save Changes"**

### 4️⃣ Render Hará Automáticamente:
- ⏳ Detectará el cambio
- ⏳ Iniciará re-despliegue
- ⏳ Tomará ~2-3 minutos

### 5️⃣ Verificar en Logs
- [ ] Click en **"Logs"** en el menú lateral
- [ ] Buscar estos mensajes:
```
✅ Conexión a Azure Cosmos DB establecida
📦 Contenedor carnets: carnets_id
📦 Contenedor citas: cita_id
📦 Contenedor promociones: promociones_salud  ⬅️ ESTE ES IMPORTANTE
🚀 Servidor corriendo en puerto 3000
```

### 6️⃣ Probar en tu App Flutter
- [ ] Abrir la app de carnets
- [ ] Iniciar sesión
- [ ] Ver si aparecen las promociones

---

## 🚨 ¿Problemas?

### Si no aparece el mensaje de "Contenedor promociones":
1. Verifica que la variable esté bien escrita: `COSMOS_CONTAINER_PROMOCIONES`
2. Verifica que el valor sea: `promociones_salud`
3. Guarda cambios y espera nuevo despliegue

### Si no aparecen promociones en la app:
1. Verifica que en Cosmos DB existan documentos en `promociones_salud`
2. Verifica que tengan `autorizado: true`
3. Verifica que el campo `matricula` sea tu matrícula o `null`

---

## ✅ YA ESTÁ TODO LISTO EN:
- ✅ Código actualizado y pusheado a GitHub
- ✅ Backend leerá automáticamente de Cosmos DB
- ✅ Solo falta: Agregar la variable en Render

---

## 📚 Documentos de Referencia:
- `CONFIGURAR_RENDER.md` - Guía detallada
- `RESUMEN_INTEGRACION.md` - Documentación técnica completa

---

## 🎉 ¡Eso es todo!
Solo agrega la variable `COSMOS_CONTAINER_PROMOCIONES` en Render y todo funcionará automáticamente.
