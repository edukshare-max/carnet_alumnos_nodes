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
    let carnet;
    let nombreCompleto = 'Alumno';
    
    try {
      carnet = await findCarnetByMatricula(matricula);
      nombreCompleto = carnet?.nombreCompleto || 'Alumno';
    } catch (err) {
      console.log('⚠️ Error obteniendo carnet, usando nombre genérico:', err.message);
    }
    
    // Obtener notas médicas
    const notas = await findNotasMedicasByMatricula(matricula);
    
    console.log(`📋 Notas obtenidas de DB: ${notas.length}`);
    if (notas.length > 0) {
      console.log('📄 Primera nota:', JSON.stringify(notas[0], null, 2));
    }
    
    // Transformar notas a formato de consulta
    const consultas = notas.map(nota => {
      // Extraer diagnóstico del campo cuerpo si existe
      let diagnostico = 'Consulta médica';
      if (nota.cuerpo) {
        const match = nota.cuerpo.match(/Diagnóstico:\s*([^\n]+)/i);
        if (match) {
          diagnostico = match[1].trim();
        }
      }
      
      const consulta = {
        id: nota.id,
        matricula: nota.matricula,
        nombreCompleto: nombreCompleto,
        fecha: nota.fecha || nota.fechaConsulta || nota.createdAt,
        diagnostico: diagnostico,
        medico: nota.tratante || nota.medico || nota.doctor || 'Servicio Médico UAGro',
        departamento: nota.departamento || nota.servicio || 'Consultorio Médico',
        observaciones: nota.cuerpo || nota.observaciones || nota.tratamiento || '',
        tipo: nota.tipo || 'Consulta general'
      };
      
      console.log('🔄 Consulta mapeada:', JSON.stringify(consulta, null, 2));
      return consulta;
    });
    
    console.log(`✅ ${consultas.length} consultas transformadas y listas para enviar`);
    
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
