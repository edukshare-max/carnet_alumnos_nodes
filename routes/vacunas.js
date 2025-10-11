const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getCosmosContainer } = require('../config/database');

/**
 * @route   GET /api/me/vacunas
 * @desc    Obtener historial de vacunación del estudiante autenticado
 * @access  Private (requiere token JWT)
 * @returns {Array} Lista de vacunas aplicadas ordenadas por fecha
 */
router.get('/me/vacunas', authMiddleware, async (req, res) => {
  try {
    const { matricula } = req.user; // Extraída del token JWT por authMiddleware

    console.log(`📋 [VACUNAS] Consultando vacunas para matrícula: ${matricula}`);

    // Obtener contenedor de Cosmos DB
    const container = await getCosmosContainer('Tarjeta_vacunacion');

    // Query para obtener todas las vacunas del estudiante
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.matricula = @matricula AND c.tipo = @tipo ORDER BY c.fechaAplicacion DESC',
      parameters: [
        { name: '@matricula', value: matricula },
        { name: '@tipo', value: 'aplicacion_vacuna' }
      ]
    };

    const { resources: vacunas } = await container.items
      .query(querySpec)
      .fetchAll();

    console.log(`✅ [VACUNAS] Encontradas ${vacunas.length} vacunas para ${matricula}`);

    // Mapear datos a formato limpio (remover metadatos de Cosmos DB)
    const vacunasLimpias = vacunas.map(v => ({
      id: v.id,
      matricula: v.matricula,
      nombreEstudiante: v.nombreEstudiante,
      campana: v.campana,
      vacuna: v.vacuna,
      dosis: v.dosis,
      lote: v.lote,
      aplicadoPor: v.aplicadoPor,
      fechaAplicacion: v.fechaAplicacion,
      observaciones: v.observaciones,
      timestamp: v.timestamp
    }));

    res.json({
      success: true,
      data: vacunasLimpias,
      total: vacunasLimpias.length
    });

  } catch (error) {
    console.error('❌ [VACUNAS] Error obteniendo vacunas:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener el historial de vacunación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/vacunas/estadisticas
 * @desc    Obtener estadísticas generales de vacunación (ADMIN)
 * @access  Private (admin)
 */
router.get('/estadisticas', authMiddleware, async (req, res) => {
  try {
    // TODO: Implementar verificación de rol admin
    
    const container = await getCosmosContainer('Tarjeta_vacunacion');

    const querySpec = {
      query: `
        SELECT 
          c.vacuna,
          COUNT(1) as total,
          MAX(c.fechaAplicacion) as ultimaAplicacion
        FROM c 
        WHERE c.tipo = 'aplicacion_vacuna'
        GROUP BY c.vacuna
      `
    };

    const { resources: estadisticas } = await container.items
      .query(querySpec)
      .fetchAll();

    res.json({
      success: true,
      data: estadisticas
    });

  } catch (error) {
    console.error('❌ [VACUNAS] Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

module.exports = router;
