const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  findAlebrijeByMatricula,
  createAlebrije,
  updateAlebrije,
  recordInteraction
} = require('../config/database');

/**
 * GET /me/alebrije
 * Obtener el alebrije del estudiante
 */
router.get('/alebrije', authenticateToken, async (req, res) => {
  try {
    const matricula = req.user.matricula;
    console.log(`🎨 [ALEBRIJE] Obteniendo alebrije para matrícula: ${matricula}`);

    const alebrije = await findAlebrijeByMatricula(matricula);

    if (!alebrije) {
      console.log(`⚠️ [ALEBRIJE] No se encontró alebrije para matrícula: ${matricula}`);
      return res.status(404).json({
        error: 'Alebrije no encontrado',
        mensaje: 'El estudiante aún no ha creado su alebrije guardián'
      });
    }

    console.log(`✅ [ALEBRIJE] Alebrije encontrado: ${alebrije.nombre} (Nivel ${alebrije.nivelEvolucion})`);
    res.json(alebrije);
  } catch (error) {
    console.error('❌ [ALEBRIJE] Error al obtener alebrije:', error);
    res.status(500).json({
      error: 'Error al obtener alebrije',
      detalles: error.message
    });
  }
});

/**
 * POST /me/alebrije
 * Crear un nuevo alebrije para el estudiante
 * Acepta objeto completo del alebrije generado en el frontend
 */
router.post('/alebrije', authenticateToken, async (req, res) => {
  try {
    const matricula = req.user.matricula;
    const alebrijeData = req.body;

    console.log(`🎨 [ALEBRIJE] Guardando alebrije para matrícula: ${matricula}`);
    console.log(`   - Nombre: ${alebrijeData.nombre}`);
    console.log(`   - Especie: ${alebrijeData.dna?.especieBase || 'desconocida'}`);

    // Verificar si ya existe un alebrije
    const alebrijeExistente = await findAlebrijeByMatricula(matricula);
    if (alebrijeExistente) {
      console.log(`⚠️ [ALEBRIJE] Ya existe, actualizando en su lugar...`);
      // Si ya existe, actualizar en lugar de crear
      const alebrijeActualizado = await updateAlebrije(matricula, {
        ...alebrijeData,
        matricula, // Asegurar que la matrícula sea correcta
      });
      return res.status(200).json(alebrijeActualizado);
    }

    // Guardar el alebrije completo tal como viene del frontend
    const alebrijeParaGuardar = {
      ...alebrijeData,
      matricula, // Asegurar que la matrícula del token se use
      createdAt: alebrijeData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { getAlebrijesContainer, cleanCosmosDocument } = require('../config/database');
    const { resource } = await getAlebrijesContainer().items.create(alebrijeParaGuardar);

    console.log(`✅ [ALEBRIJE] Alebrije guardado exitosamente en Cosmos DB`);
    console.log(`   - ID: ${resource.id}`);
    console.log(`   - Matrícula: ${resource.matricula}`);
    
    res.status(201).json(cleanCosmosDocument(resource));
  } catch (error) {
    console.error('❌ [ALEBRIJE] Error al guardar alebrije:', error);
    res.status(500).json({
      error: 'Error al guardar alebrije',
      detalles: error.message
    });
  }
});

/**
 * PUT /me/alebrije
 * Actualizar el estado del alebrije (acepta objeto completo)
 */
router.put('/alebrije', authenticateToken, async (req, res) => {
  try {
    const matricula = req.user.matricula;
    const alebrijeData = req.body;

    console.log(`🔄 [ALEBRIJE] Actualizando alebrije para matrícula: ${matricula}`);
    console.log(`   - Nombre: ${alebrijeData.nombre || 'sin cambios'}`);
    console.log(`   - Nivel: ${alebrijeData.nivelEvolucion || 'desconocido'}`);

    // Actualizar con todos los datos del alebrije
    const alebrijeActualizado = await updateAlebrije(matricula, {
      ...alebrijeData,
      matricula, // Asegurar que la matrícula sea correcta
      updatedAt: new Date().toISOString()
    });

    if (!alebrijeActualizado) {
      return res.status(404).json({
        error: 'Alebrije no encontrado'
      });
    }

    console.log(`✅ [ALEBRIJE] Alebrije actualizado exitosamente`);
    res.json(alebrijeActualizado);
  } catch (error) {
    console.error('❌ [ALEBRIJE] Error al actualizar alebrije:', error);
    res.status(500).json({
      error: 'Error al actualizar alebrije',
      detalles: error.message
    });
  }
});

/**
 * POST /me/alebrije/interaccion
 * Registrar una interacción con el alebrije (alimentar, jugar, curar, descansar)
 */
router.post('/alebrije/interaccion', authenticateToken, async (req, res) => {
  try {
    const matricula = req.user.matricula;
    const { tipo, cantidad } = req.body;

    console.log(`🎮 [ALEBRIJE] Interacción ${tipo} para matrícula: ${matricula}`);

    // Validar tipo de interacción
    const tiposValidos = ['alimentar', 'jugar', 'curar', 'descansar'];
    if (!tipo || !tiposValidos.includes(tipo)) {
      return res.status(400).json({
        error: 'Tipo de interacción inválido',
        tiposValidos
      });
    }

    // Registrar interacción
    await recordInteraction(matricula, tipo, cantidad || 0);

    console.log(`✅ [ALEBRIJE] Interacción registrada: ${tipo}`);
    res.json({
      mensaje: 'Interacción registrada exitosamente',
      tipo,
      cantidad
    });
  } catch (error) {
    console.error('❌ [ALEBRIJE] Error al registrar interacción:', error);
    res.status(500).json({
      error: 'Error al registrar interacción',
      detalles: error.message
    });
  }
});

/**
 * POST /me/alebrije/experiencia
 * Agregar experiencia al alebrije (actividad de salud completada)
 */
router.post('/alebrije/experiencia', authenticateToken, async (req, res) => {
  try {
    const matricula = req.user.matricula;
    const { puntos, motivo } = req.body;

    console.log(`⭐ [ALEBRIJE] Agregando ${puntos} XP para matrícula: ${matricula} - ${motivo}`);

    if (!puntos || puntos <= 0) {
      return res.status(400).json({
        error: 'Puntos inválidos'
      });
    }

    const alebrije = await findAlebrijeByMatricula(matricula);
    if (!alebrije) {
      return res.status(404).json({
        error: 'Alebrije no encontrado'
      });
    }

    // Calcular nueva experiencia
    const nuevaExperiencia = alebrije.puntosExperiencia + puntos;
    
    res.json({
      mensaje: 'Experiencia agregada',
      puntosAgregados: puntos,
      experienciaTotal: nuevaExperiencia,
      motivo
    });
  } catch (error) {
    console.error('❌ [ALEBRIJE] Error al agregar experiencia:', error);
    res.status(500).json({
      error: 'Error al agregar experiencia',
      detalles: error.message
    });
  }
});

/**
 * POST /me/alebrije/capsula
 * Registrar cápsula obtenida por el estudiante (consulta/vacuna)
 */
router.post('/alebrije/capsula', authenticateToken, async (req, res) => {
  try {
    const matricula = req.user.matricula;
    const { capsula, servicioSalud } = req.body;

    if (!capsula || !servicioSalud) {
      return res.status(400).json({
        error: 'Datos incompletos',
        mensaje: 'Se requiere información de la cápsula y servicio de salud'
      });
    }

    console.log(`💊 [CAPSULA] Registrando cápsula para ${matricula} (${servicioSalud}): ${capsula.nombre} [${capsula.rareza}]`);

    // Registrar interacción de cápsula obtenida
    await recordInteraction(matricula, 'capsula_obtenida', {
      tipo: capsula.tipo,
      rareza: capsula.rareza,
      nombre: capsula.nombre,
      emoji: capsula.emoji,
      servicio: servicioSalud,
      duracion: capsula.duracion ? capsula.duracion : 'permanente',
      efectos: {
        bonosSalud: capsula.bonosSalud || 0,
        bonosHambre: capsula.bonosHambre || 0,
        bonosFelicidad: capsula.bonosFelicidad || 0,
        bonosEnergia: capsula.bonosEnergia || 0,
        multiplicadorExperiencia: capsula.multiplicadorExperiencia || 1.0,
      },
      timestamp: new Date().toISOString()
    });

    res.json({
      mensaje: '¡Cápsula obtenida!',
      capsula: {
        id: capsula.id,
        nombre: capsula.nombre,
        rareza: capsula.rareza,
        emoji: capsula.emoji,
        descripcion: capsula.descripcion
      },
      servicio: servicioSalud
    });
  } catch (error) {
    console.error('❌ [CAPSULA] Error al registrar cápsula:', error);
    res.status(500).json({
      error: 'Error al registrar cápsula',
      detalles: error.message
    });
  }
});

/**
 * GET /me/alebrije/capsulas/historial
 * Obtener historial de cápsulas obtenidas
 */
router.get('/alebrije/capsulas/historial', authenticateToken, async (req, res) => {
  try {
    const matricula = req.user.matricula;
    console.log(`💊 [CAPSULA] Obteniendo historial de cápsulas para ${matricula}`);

    const alebrije = await findAlebrijeByMatricula(matricula);
    
    if (!alebrije) {
      return res.status(404).json({
        error: 'Alebrije no encontrado'
      });
    }

    // Las cápsulas se manejan en el frontend localStorage
    // Este endpoint puede servir para estadísticas futuras
    res.json({
      mensaje: 'Historial de cápsulas',
      matricula: matricula,
      // El frontend maneja el estado de cápsulas
    });
  } catch (error) {
    console.error('❌ [CAPSULA] Error al obtener historial:', error);
    res.status(500).json({
      error: 'Error al obtener historial de cápsulas',
      detalles: error.message
    });
  }
});

module.exports = router;
