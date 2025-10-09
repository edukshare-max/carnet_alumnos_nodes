const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  findPromocionesByMatricula, 
  registrarClickPromocion,
  cleanCosmosDocument 
} = require('../config/database');

/**
 * GET /me/promociones
 * Obtener promociones activas para el usuario autenticado desde Cosmos DB
 */
router.get('/promociones', authenticateToken, async (req, res) => {
  try {
    const { matricula } = req.user;

    // Buscar promociones en Cosmos DB
    const promociones = await findPromocionesByMatricula(matricula);

    // Limpiar documentos de campos técnicos de Cosmos DB
    const promocionesLimpias = promociones.map(cleanCosmosDocument);

    console.log(`📢 ${promocionesLimpias.length} promociones encontradas para matrícula: ${matricula}`);

    res.json({
      success: true,
      data: promocionesLimpias,
      count: promocionesLimpias.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo promociones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener promociones de salud'
    });
  }
});

/**
 * POST /promociones/:id/click
 * Registrar cuando un usuario hace click en una promoción
 */
router.post('/:id/click', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { matricula } = req.user;

    // Registrar el click (para estadísticas)
    await registrarClickPromocion(id, matricula);

    res.json({
      success: true,
      message: 'Click registrado'
    });

  } catch (error) {
    console.error('❌ Error registrando click:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar click'
    });
  }
});

module.exports = router;