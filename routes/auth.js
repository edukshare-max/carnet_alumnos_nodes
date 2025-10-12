const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { 
  findCarnetByEmailAndMatricula, 
  findUsuarioByMatricula,
  findUsuarioByCorreo,
  createUsuario 
} = require('../config/database');
const { generateToken } = require('../middleware/auth');

/**
 * POST /auth/register
 * Registrar nuevo usuario con validación en base de carnets
 */
router.post('/register', async (req, res) => {
  try {
    const { correo, matricula, password } = req.body;

    // Validar campos requeridos
    if (!correo || !matricula || !password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION',
        message: 'Correo, matrícula y contraseña son requeridos'
      });
    }

    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION',
        message: 'Formato de correo inválido'
      });
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION',
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // 1. Verificar que correo + matrícula existen en base de carnets
    const carnet = await findCarnetByEmailAndMatricula(correo, matricula);
    
    if (!carnet) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'El correo y matrícula no coinciden con ningún carnet registrado'
      });
    }

    // 2. Verificar que no exista ya un usuario con esa matrícula
    const usuarioExistente = await findUsuarioByMatricula(matricula);
    
    if (usuarioExistente) {
      return res.status(409).json({
        success: false,
        error: 'ALREADY_EXISTS',
        message: 'Ya existe una cuenta con esta matrícula'
      });
    }

    // 3. Hash de la contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Crear usuario
    const nuevoUsuario = await createUsuario({
      correo,
      matricula,
      passwordHash
    });

    // 5. Generar token JWT
    const token = generateToken(matricula);

    console.log(`✅ Usuario registrado exitosamente: ${matricula}`);

    // 6. Respuesta exitosa
    res.status(201).json({
      success: true,
      token,
      matricula,
      message: 'Usuario registrado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER',
      message: 'Error interno del servidor'
    });
  }
});

/**
 * POST /auth/login
 * Autenticar usuario con matrícula y contraseña
 */
router.post('/login', async (req, res) => {
  try {
    const { matricula, password } = req.body;

    // Validar campos requeridos
    if (!matricula || !password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION',
        message: 'Matrícula y contraseña son requeridos'
      });
    }

    // 1. Buscar usuario por matrícula
    const usuario = await findUsuarioByMatricula(matricula);

    if (!usuario) {
      return res.status(401).json({
        success: false,
        error: 'CREDENTIALS_ERROR',
        message: 'Matrícula o contraseña incorrectos'
      });
    }

    // 2. Verificar contraseña
    const passwordValido = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordValido) {
      return res.status(401).json({
        success: false,
        error: 'CREDENTIALS_ERROR',
        message: 'Matrícula o contraseña incorrectos'
      });
    }

    // 3. Generar JWT token
    const token = generateToken(usuario.matricula);

    console.log(`✅ Login exitoso para matrícula: ${usuario.matricula}`);

    // 4. Respuesta exitosa
    res.json({
      success: true,
      token,
      matricula: usuario.matricula,
      message: 'Login exitoso'
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER',
      message: 'Error interno del servidor'
    });
  }
});

/**
 * POST /auth/verify
 * Verificar si un token es válido (opcional, para debugging)
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token requerido'
      });
    }

    const { verifyToken } = require('../middleware/auth');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    res.json({
      success: true,
      valid: true,
      matricula: decoded.matricula,
      iat: decoded.iat,
      exp: decoded.exp
    });

  } catch (error) {
    console.error('❌ Error verificando token:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;