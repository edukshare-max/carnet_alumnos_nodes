// 📋 RUTAS DE CONSULTAS MÉDICAS
// Endpoint para obtener las consultas/notas médicas del alumno

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { findNotasMedicasByMatricula, findCarnetByMatricula } = require('../config/database');

/**
 * GET /me/consultas
 * Obtener historial de consultas médicas del usuario autenticado
 * Requiere autenticación JWT
 */
router.get('/consultas', authenticateToken, async (req, res) => {
  try {
    const matricula = req.user.matricula;
    
    console.log(`🔍 Consultando notas médicas para matrícula: ${matricula}`);
    
    // Obtener información del carnet para el nombre completo
    const carnet = await findCarnetByMatricula(matricula);
    
    if (!carnet) {
      return res.status(404).json({
        success: false,
        error: 'CARNET_NOT_FOUND',
        message: 'No se encontró información del alumno'
      });
    }
    
    // Obtener notas médicas
    const notas = await findNotasMedicasByMatricula(matricula);
    
    // Transformar notas a formato de consulta
    const consultas = notas.map(nota => ({
      id: nota.id,
      matricula: nota.matricula,
      nombreCompleto: carnet.nombreCompleto,
      fecha: nota.fecha || nota.fechaConsulta || nota.createdAt,
      diagnostico: nota.diagnostico || nota.nota || nota.motivo || 'Consulta médica',
      medico: nota.medico || nota.doctor || 'Servicio Médico UAGro',
      departamento: nota.departamento || nota.servicio || 'Consultorio Médico',
      observaciones: nota.observaciones || nota.tratamiento || '',
      tipo: nota.tipo || 'Consulta general'
    }));
    
    console.log(`✅ ${consultas.length} consultas encontradas`);
    
    res.json({
      success: true,
      data: consultas,
      total: consultas.length
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo consultas:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
