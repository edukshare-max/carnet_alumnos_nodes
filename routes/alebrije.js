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
 */
router.post('/alebrije', authenticateToken, async (req, res) => {
  try {
    const matricula = req.user.matricula;
    const { especieBase, nombre } = req.body;

    console.log(`🎨 [ALEBRIJE] Creando alebrije para matrícula: ${matricula}, especie: ${especieBase}`);

    // Validar especie
    const especiesValidas = ['jaguar', 'aguila', 'serpiente', 'venado', 'colibri'];
    if (!especieBase || !especiesValidas.includes(especieBase)) {
      return res.status(400).json({
        error: 'Especie inválida',
        especiesValidas
      });
    }

    // Verificar si ya existe un alebrije
    const alebrijeExistente = await findAlebrijeByMatricula(matricula);
    if (alebrijeExistente) {
      return res.status(409).json({
        error: 'Alebrije ya existe',
        mensaje: 'El estudiante ya tiene un alebrije guardián',
        alebrije: alebrijeExistente
      });
    }

    // Crear alebrije (el backend genera el DNA)
    const nuevoAlebrije = await createAlebrije(matricula, especieBase, nombre);

    console.log(`✅ [ALEBRIJE] Alebrije creado exitosamente: ${nuevoAlebrije.id}`);
    res.status(201).json(nuevoAlebrije);
  } catch (error) {
    console.error('❌ [ALEBRIJE] Error al crear alebrije:', error);
    res.status(500).json({
      error: 'Error al crear alebrije',
      detalles: error.message
    });
  }
});

/**
 * PUT /me/alebrije
 * Actualizar el estado del alebrije
 */
router.put('/alebrije', authenticateToken, async (req, res) => {
  try {
    const matricula = req.user.matricula;
    const { estado, puntosExperiencia, nivelEvolucion, dna, historialEvoluciones } = req.body;

    console.log(`🔄 [ALEBRIJE] Actualizando alebrije para matrícula: ${matricula}`);

    const alebrijeActualizado = await updateAlebrije(matricula, {
      estado,
      puntosExperiencia,
      nivelEvolucion,
      dna,
      historialEvoluciones,
      updatedAt: new Date().toISOString()
    });

    if (!alebrijeActualizado) {
      return res.status(404).json({
        error: 'Alebrije no encontrado'
      });
    }

    console.log(`✅ [ALEBRIJE] Alebrije actualizado: ${alebrijeActualizado.id}`);
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
