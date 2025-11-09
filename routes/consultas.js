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
    
    console.log(`🔍 [CONSULTAS] Iniciando consulta para matrícula: ${matricula} (tipo original: ${typeof matricula})`);
    
    // Obtener información del carnet para el nombre completo
    let nombreCompleto = 'Alumno';
    
    try {
      console.log('📝 [CONSULTAS] Intentando obtener carnet...');
      const carnet = await findCarnetByMatricula(matricula);
      nombreCompleto = carnet?.nombreCompleto || 'Alumno';
      console.log(`✅ [CONSULTAS] Carnet obtenido: ${nombreCompleto}`);
    } catch (err) {
      console.log('⚠️ [CONSULTAS] Error obteniendo carnet, usando nombre genérico:', err.message);
    }
    
    // Obtener notas médicas
    console.log('📋 [CONSULTAS] Consultando notas médicas en BD...');
    let notas = [];
    try {
      notas = await findNotasMedicasByMatricula(matricula);
      console.log(`✅ [CONSULTAS] Notas obtenidas de DB: ${notas.length}`);
    } catch (err) {
      console.error('❌ [CONSULTAS] Error obteniendo notas:', err);
      // Continuar con array vacío
      notas = [];
    }
    
    
    if (notas.length > 0) {
      console.log('📄 [CONSULTAS] Primera nota:', JSON.stringify(notas[0], null, 2));
    } else {
      console.log('📭 [CONSULTAS] No se encontraron notas médicas');
    }
    
    // Transformar notas a formato de consulta
    console.log('🔄 [CONSULTAS] Transformando notas a formato de consulta...');
    const consultas = notas.map(nota => {
      // Log de la nota completa para debug
      console.log('📄 [CONSULTAS] NOTA COMPLETA:', JSON.stringify(nota, null, 2));
      
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
      
      console.log('🔄 [CONSULTAS] Consulta mapeada:', JSON.stringify(consulta, null, 2));
      return consulta;
    });
    
    console.log(`✅ [CONSULTAS] ${consultas.length} consultas transformadas y listas para enviar`);
    
    res.json({
      success: true,
      data: consultas,
      total: consultas.length
    });
    
  } catch (error) {
    console.error('❌ [CONSULTAS] Error CRÍTICO:', error);
    console.error('❌ [CONSULTAS] Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
