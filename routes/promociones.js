const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Simulamos una base de datos en memoria para promociones
// En producción esto estaría en Cosmos DB
let promocionesDB = [
  {
    id: "promo_001",
    titulo: "Campaña de Vacunación Influenza 2024",
    descripcion: "Vacúnate contra la influenza. Protege tu salud y la de tu comunidad universitaria.",
    imagenUrl: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=400",
    linkDestino: "https://salud.uagro.mx/vacunacion-influenza",
    fechaCreacion: new Date().toISOString(),
    fechaExpiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
    tipoTarget: "todos",
    targetValue: null,
    activa: true,
    metadatos: {
      prioridad: "alta",
      categoria: "vacunacion"
    }
  },
  {
    id: "promo_002", 
    titulo: "Jornada de Salud Mental",
    descripcion: "Consultas gratuitas de psicología. Cuida tu bienestar emocional durante el período académico.",
    imagenUrl: "https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800&h=400",
    linkDestino: "https://salud.uagro.mx/salud-mental",
    fechaCreacion: new Date().toISOString(),
    fechaExpiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    tipoTarget: "todos",
    targetValue: null,
    activa: true,
    metadatos: {
      prioridad: "media",
      categoria: "salud_mental"
    }
  },
  {
    id: "promo_003",
    titulo: "Revisión Dental Gratuita",
    descripcion: "Aprovecha nuestro programa de salud dental. Revisiones y limpiezas sin costo.",
    imagenUrl: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=800&h=400",
    linkDestino: "https://salud.uagro.mx/odontologia",
    fechaCreacion: new Date().toISOString(),
    fechaExpiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    tipoTarget: "todos",
    targetValue: null,
    activa: true,
    metadatos: {
      prioridad: "baja",
      categoria: "odontologia"
    }
  }
];

/**
 * GET /promociones/activas
 * Obtener promociones activas para el usuario autenticado
 */
router.get('/activas', authenticateToken, async (req, res) => {
  try {
    const { matricula, departamento } = req.user;
    const ahora = new Date();

    // Filtrar promociones vigentes y aplicables al usuario
    const promocionesActivas = promocionesDB.filter(promo => {
      const fechaExp = new Date(promo.fechaExpiracion);
      const fechaCreacion = new Date(promo.fechaCreacion);
      
      // Verificar vigencia
      const estaVigente = promo.activa && 
                         ahora >= fechaCreacion && 
                         ahora <= fechaExp;
      
      if (!estaVigente) return false;
      
      // Verificar si aplica al usuario
      switch (promo.tipoTarget) {
        case 'todos':
          return true;
        case 'departamento':
          return departamento === promo.targetValue;
        case 'alumno':
          return matricula === promo.targetValue;
        default:
          return false;
      }
    });

    console.log(`📢 ${promocionesActivas.length} promociones activas para matrícula: ${matricula}`);

    res.json({
      success: true,
      data: promocionesActivas,
      count: promocionesActivas.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo promociones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * POST /promociones/crear
 * Crear nueva promoción (para ser llamado desde CRES_Carnets)
 * Requiere clave de supervisor en el header
 */
router.post('/crear', async (req, res) => {
  try {
    const supervisorKey = req.headers['x-supervisor-key'];
    
    // Validar clave de supervisor (en producción esto estaría en variables de entorno)
    const SUPERVISOR_KEY = process.env.SUPERVISOR_KEY || 'UAGRO_SALUD_2024';
    
    if (!supervisorKey || supervisorKey !== SUPERVISOR_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Clave de supervisor inválida'
      });
    }

    const {
      titulo,
      descripcion,
      imagenUrl,
      linkDestino,
      tipoTarget,
      targetValue,
      duracionDias = 7
    } = req.body;

    // Validar campos requeridos
    if (!titulo || !descripcion || !tipoTarget) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: titulo, descripcion, tipoTarget'
      });
    }

    // Crear nueva promoción
    const nuevaPromocion = {
      id: `promo_${Date.now()}`,
      titulo,
      descripcion,
      imagenUrl: imagenUrl || null,
      linkDestino: linkDestino || null,
      fechaCreacion: new Date().toISOString(),
      fechaExpiracion: new Date(Date.now() + duracionDias * 24 * 60 * 60 * 1000).toISOString(),
      tipoTarget,
      targetValue: targetValue || null,
      activa: true,
      metadatos: {
        creadoPor: 'CRES_Carnets',
        timestamp: Date.now()
      }
    };

    // Guardar en "base de datos"
    promocionesDB.push(nuevaPromocion);

    console.log(`📢 Nueva promoción creada: ${nuevaPromocion.id} - ${titulo}`);

    res.status(201).json({
      success: true,
      message: 'Promoción creada exitosamente',
      data: nuevaPromocion
    });

  } catch (error) {
    console.error('❌ Error creando promoción:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * DELETE /promociones/:id
 * Desactivar promoción (solo con clave de supervisor)
 */
router.delete('/:id', async (req, res) => {
  try {
    const supervisorKey = req.headers['x-supervisor-key'];
    const SUPERVISOR_KEY = process.env.SUPERVISOR_KEY || 'UAGRO_SALUD_2024';
    
    if (!supervisorKey || supervisorKey !== SUPERVISOR_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Clave de supervisor inválida'
      });
    }

    const { id } = req.params;
    const promocionIndex = promocionesDB.findIndex(p => p.id === id);

    if (promocionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Promoción no encontrada'
      });
    }

    // Desactivar en lugar de eliminar
    promocionesDB[promocionIndex].activa = false;

    console.log(`📢 Promoción desactivada: ${id}`);

    res.json({
      success: true,
      message: 'Promoción desactivada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error desactivando promoción:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * GET /promociones/todas
 * Obtener todas las promociones (para administración)
 */
router.get('/todas', async (req, res) => {
  try {
    const supervisorKey = req.headers['x-supervisor-key'];
    const SUPERVISOR_KEY = process.env.SUPERVISOR_KEY || 'UAGRO_SALUD_2024';
    
    if (!supervisorKey || supervisorKey !== SUPERVISOR_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Clave de supervisor inválida'
      });
    }

    res.json({
      success: true,
      data: promocionesDB,
      count: promocionesDB.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo todas las promociones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;