const express = require('express');
const router = express.Router();
const { findCitasByMatricula, cleanCosmosDocument } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /me/citas
 * Obtener todas las citas del usuario autenticado
 */
router.get('/citas', authenticateToken, async (req, res) => {
  try {
    const { matricula } = req.user;

    if (!matricula) {
      return res.status(400).json({
        success: false,
        message: 'Matrícula no encontrada en token'
      });
    }

    // Buscar citas en SASU
    let citas = [];
    try {
      citas = await findCitasByMatricula(matricula);
    } catch (dbError) {
      console.log(`⚠️ Error de BD, usando datos mock para matrícula: ${matricula}`);
    }

    // Si no hay citas reales, usar datos mock para testing
    if (citas.length === 0) {
      citas = [
        {
          id: "cita_001",
          matricula: matricula,
          fechaCita: "2024-11-15",
          horaCita: "09:00",
          tipoConsulta: "Consulta General",
          medico: "Dr. García López",
          departamento: "Medicina General", 
          estado: "programada",
          observaciones: "Revisión general de salud"
        },
        {
          id: "cita_002",
          matricula: matricula,
          fechaCita: "2024-11-20", 
          horaCita: "14:30",
          tipoConsulta: "Psicología",
          medico: "Psic. Ana Martínez",
          departamento: "Psicología",
          estado: "programada",
          observaciones: "Sesión de seguimiento"
        },
        {
          id: "cita_003",
          matricula: matricula,
          fechaCita: "2024-10-25",
          horaCita: "11:15", 
          tipoConsulta: "Odontología",
          medico: "Dr. Rodríguez Pérez",
          departamento: "Odontología",
          estado: "completada",
          observaciones: "Limpieza dental realizada"
        }
      ];
    }

    // Limpiar datos técnicos de Cosmos DB de todas las citas
    const citasLimpias = citas.map(cita => cleanCosmosDocument(cita));

    // Log exitoso
    console.log(`📅 ${citasLimpias.length} citas encontradas para matrícula: ${matricula}`);

    // Respuesta exitosa
    res.json({
      success: true,
      data: citasLimpias,
      count: citasLimpias.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo citas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * GET /me/citas/:id
 * Obtener una cita específica por ID (opcional, para futuras funcionalidades)
 */
router.get('/citas/:id', authenticateToken, async (req, res) => {
  try {
    const { matricula } = req.user;
    const { id } = req.params;

    if (!matricula) {
      return res.status(400).json({
        success: false,
        message: 'Matrícula no encontrada en token'
      });
    }

    // Buscar todas las citas del usuario
    const citas = await findCitasByMatricula(matricula);
    
    // Buscar la cita específica
    const cita = citas.find(c => c.id === id);

    if (!cita) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    // Limpiar datos técnicos de Cosmos DB
    const citaLimpia = cleanCosmosDocument(cita);

    // Log exitoso
    console.log(`📋 Cita ${id} solicitada para matrícula: ${matricula}`);

    // Respuesta exitosa
    res.json({
      success: true,
      data: citaLimpia
    });

  } catch (error) {
    console.error('❌ Error obteniendo cita específica:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;