const { CosmosClient } = require('@azure/cosmos');

let cosmosClient;
let database;
let carnetsContainer;
let citasContainer;
let promocionesContainer;
let usuariosContainer;
let notasContainer;
let alebrijesContainer;

/**
 * Inicializar conexión a Azure Cosmos DB
 */
async function connectToCosmosDB() {
  try {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    const databaseName = process.env.COSMOS_DATABASE || 'SASU';
    const carnetsContainerName = process.env.COSMOS_CONTAINER_CARNETS || 'carnets_id';
    const citasContainerName = process.env.COSMOS_CONTAINER_CITAS || 'cita_id';
    const promocionesContainerName = process.env.COSMOS_CONTAINER_PROMOCIONES || 'promociones_salud';
    const notasContainerName = process.env.COSMOS_CONTAINER_NOTAS || 'notas';
    const alebrijesContainerName = process.env.COSMOS_CONTAINER_ALEBRIJES || 'alebrijes_estudiantes';
    // Forzar el nombre correcto del contenedor (ignorar variable de entorno)
    const usuariosContainerName = 'usuarios_matricula';

    if (!endpoint || !key) {
      throw new Error('COSMOS_ENDPOINT y COSMOS_KEY son requeridos en variables de entorno');
    }

    // Crear cliente de Cosmos DB con configuración optimizada
    cosmosClient = new CosmosClient({
      endpoint,
      key,
      userAgentSuffix: 'CarnetDigitalUAGro/v2.0',
      connectionPolicy: {
        requestTimeout: 30000,        // Timeout de 30s por request
        enableEndpointDiscovery: true, // Auto-descubrimiento de endpoints
        preferredLocations: [],        // Usar región primaria
        retryOptions: {
          maxRetryAttemptCount: 3,     // 3 reintentos automáticos
          fixedRetryIntervalInMilliseconds: 1000,  // 1s entre reintentos
          maxWaitTimeInSeconds: 30     // Máximo 30s de espera total
        }
      }
      // NOTA: La propiedad 'agent' no es compatible con @azure/cosmos v4.x
      // El SDK maneja automáticamente el connection pooling
    });

    // Conectar a la base de datos
    database = cosmosClient.database(databaseName);
    
    // Verificar que la base de datos existe
    const { database: dbResponse } = await database.read();
    console.log(`📚 Conectado a base de datos: ${dbResponse.id}`);

    // Conectar a contenedores
    carnetsContainer = database.container(carnetsContainerName);
    citasContainer = database.container(citasContainerName);
    promocionesContainer = database.container(promocionesContainerName);
    notasContainer = database.container(notasContainerName);
    alebrijesContainer = database.container(alebrijesContainerName);
    usuariosContainer = database.container(usuariosContainerName);

    // Verificar que los contenedores existen
    const { container: carnetsResponse } = await carnetsContainer.read();
    const { container: citasResponse } = await citasContainer.read();
    const { container: promocionesResponse } = await promocionesContainer.read();
    
    console.log(`📦 Contenedor carnets: ${carnetsResponse.id}`);
    console.log(`📦 Contenedor citas: ${citasResponse.id}`);
    console.log(`📦 Contenedor promociones: ${promocionesResponse.id}`);
    
    // Intentar conectar al contenedor de alebrijes
    try {
      const { container: alebrijesResponse } = await alebrijesContainer.read();
      console.log(`📦 Contenedor alebrijes: ${alebrijesResponse.id}`);
    } catch (error) {
      if (error.code === 404) {
        console.log(`⚠️ Contenedor alebrijes_estudiantes no existe. Se necesita crear manualmente en Azure Portal.`);
      } else {
        throw error;
      }
    }
    
    // Intentar conectar al contenedor de usuarios (crear si no existe)
    try {
      const { container: usuariosResponse } = await usuariosContainer.read();
      console.log(`📦 Contenedor usuarios: ${usuariosResponse.id}`);
    } catch (error) {
      if (error.code === 404) {
        console.log(`⚠️ Contenedor usuarios no existe. Se necesita crear manualmente en Azure Portal.`);
      } else {
        throw error;
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error conectando a Cosmos DB:', error.message);
    throw error;
  }
}

/**
 * Buscar carnet por correo y matrícula
 * @param {string} correo - Email del usuario
 * @param {string} matricula - Matrícula del usuario
 * @returns {Object|null} - Documento del carnet o null si no existe
 */
async function findCarnetByEmailAndMatricula(correo, matricula) {
  try {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.correo = @correo AND c.matricula = @matricula',
      parameters: [
        { name: '@correo', value: correo },
        { name: '@matricula', value: matricula }
      ]
    };

    const { resources } = await carnetsContainer.items.query(querySpec).fetchAll();
    return resources.length > 0 ? resources[0] : null;
  } catch (error) {
    console.error('Error buscando carnet:', error);
    throw error;
  }
}

/**
 * Buscar carnet por matrícula
 * @param {string} matricula - Matrícula del usuario
 * @returns {Object|null} - Documento del carnet o null si no existe
 */
async function findCarnetByMatricula(matricula) {
  try {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.matricula = @matricula',
      parameters: [
        { name: '@matricula', value: matricula }
      ]
    };

    const { resources } = await carnetsContainer.items.query(querySpec).fetchAll();
    return resources.length > 0 ? resources[0] : null;
  } catch (error) {
    console.error('Error buscando carnet por matrícula:', error);
    throw error;
  }
}

/**
 * Buscar citas por matrícula
 * @param {string} matricula - Matrícula del usuario
 * @returns {Array} - Array de citas del usuario
 */
async function findCitasByMatricula(matricula) {
  try {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.matricula = @matricula ORDER BY c.inicio DESC',
      parameters: [
        { name: '@matricula', value: matricula }
      ]
    };

    const { resources } = await citasContainer.items.query(querySpec).fetchAll();
    return resources;
  } catch (error) {
    console.error('Error buscando citas:', error);
    throw error;
  }
}

/**
 * Buscar promociones por matrícula
 * Retorna promociones que:
 * - Son para la matrícula específica (matricula = "15662" por ejemplo) → NO requieren autorización
 * - Son para todos los alumnos (matricula vacía) → REQUIEREN autorización
 * - Son generales (destinatario = "general") → REQUIEREN autorización
 * - Solo muestra promociones de los últimos 7 días
 * @param {string} matricula - Matrícula del usuario
 * @returns {Array} - Array de promociones aplicables al usuario
 */
async function findPromocionesByMatricula(matricula) {
  try {
    // Calcular fecha de hace 7 días
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 7);
    const fechaLimiteISO = fechaLimite.toISOString();
    
    const querySpec = {
      query: `
        SELECT * FROM c 
        WHERE c.createdAt >= @fechaLimite
        AND (
          (c.destinatario = "general" AND c.autorizado = true)
          OR (c.destinatario = "alumno" AND c.matricula = @matricula)
          OR (c.destinatario = "alumno" AND c.autorizado = true AND (NOT IS_DEFINED(c.matricula) OR c.matricula = "" OR c.matricula = null))
        )
        ORDER BY c.createdAt DESC
      `,
      parameters: [
        { name: '@matricula', value: matricula },
        { name: '@fechaLimite', value: fechaLimiteISO }
      ]
    };

    const { resources } = await promocionesContainer.items.query(querySpec).fetchAll();
    
    console.log(`🔍 Query ejecutada para matrícula: ${matricula}`);
    console.log(`� Fecha límite (7 días): ${fechaLimiteISO}`);
    console.log(`�📊 Promociones encontradas (últimos 7 días): ${resources.length}`);
    
    return resources;
  } catch (error) {
    console.error('Error buscando promociones:', error);
    throw error;
  }
}

/**
 * Registrar click en promoción (para estadísticas)
 * @param {string} promocionId - ID de la promoción
 * @param {string} matricula - Matrícula del usuario que hizo click
 */
async function registrarClickPromocion(promocionId, matricula) {
  try {
    console.log(`📊 Click registrado - Promoción: ${promocionId}, Matrícula: ${matricula}`);
    // Aquí podrías guardar estadísticas en otro contenedor si lo necesitas
    return { success: true };
  } catch (error) {
    console.error('Error registrando click:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Limpiar datos del documento eliminando campos técnicos de Cosmos DB
 * @param {Object} documento - Documento de Cosmos DB
 * @returns {Object} - Documento limpio sin campos técnicos
 */
function cleanCosmosDocument(documento) {
  if (!documento) return null;

  // Crear copia del documento
  const cleanDoc = { ...documento };

  // Eliminar campos técnicos de Cosmos DB
  delete cleanDoc._rid;
  delete cleanDoc._self;
  delete cleanDoc._etag;
  delete cleanDoc._attachments;
  delete cleanDoc._ts;

  return cleanDoc;
}

/**
 * Obtener un contenedor de Cosmos DB por nombre
 * @param {string} containerName - Nombre del contenedor
 * @returns {Container} - Instancia del contenedor de Cosmos DB
 */
function getCosmosContainer(containerName) {
  if (!database) {
    throw new Error('Base de datos no inicializada. Llama a connectToCosmosDB() primero.');
  }
  
  console.log(`📦 Obteniendo contenedor: ${containerName}`);
  return database.container(containerName);
}

/**
 * Buscar usuario por matrícula
 * @param {string} matricula - Matrícula del usuario
 * @returns {Object|null} - Documento del usuario o null si no existe
 */
async function findUsuarioByMatricula(matricula) {
  try {
    if (!usuariosContainer) {
      throw new Error('Contenedor de usuarios no inicializado');
    }

    const querySpec = {
      query: 'SELECT * FROM c WHERE c.matricula = @matricula',
      parameters: [
        { name: '@matricula', value: matricula }
      ]
    };

    const { resources } = await usuariosContainer.items.query(querySpec).fetchAll();
    return resources.length > 0 ? resources[0] : null;
  } catch (error) {
    console.error('Error buscando usuario por matrícula:', error);
    throw error;
  }
}

/**
 * Buscar usuario por correo
 * @param {string} correo - Correo del usuario
 * @returns {Object|null} - Documento del usuario o null si no existe
 */
async function findUsuarioByCorreo(correo) {
  try {
    if (!usuariosContainer) {
      throw new Error('Contenedor de usuarios no inicializado');
    }

    const querySpec = {
      query: 'SELECT * FROM c WHERE c.correo = @correo',
      parameters: [
        { name: '@correo', value: correo }
      ]
    };

    const { resources } = await usuariosContainer.items.query(querySpec).fetchAll();
    return resources.length > 0 ? resources[0] : null;
  } catch (error) {
    console.error('Error buscando usuario por correo:', error);
    throw error;
  }
}

/**
 * Crear nuevo usuario
 * @param {Object} userData - Datos del usuario (correo, matricula, passwordHash)
 * @returns {Object} - Usuario creado
 */
async function createUsuario(userData) {
  try {
    if (!usuariosContainer) {
      throw new Error('Contenedor de usuarios no inicializado');
    }

    const nuevoUsuario = {
      id: userData.matricula, // Usar matrícula como ID
      correo: userData.correo,
      matricula: userData.matricula,
      passwordHash: userData.passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { resource } = await usuariosContainer.items.create(nuevoUsuario);
    console.log(`✅ Usuario creado: ${resource.matricula}`);
    return cleanCosmosDocument(resource);
  } catch (error) {
    console.error('Error creando usuario:', error);
    throw error;
  }
}

/**
 * Buscar notas médicas por matrícula
 * @param {string} matricula - Matrícula del usuario
 * @returns {Array} - Array de notas médicas
 */
async function findNotasMedicasByMatricula(matricula) {
  try {
    // Convertir matrícula a string para coincidir con el tipo en Cosmos DB
    const matriculaStr = String(matricula);
    
    console.log(`🔍 [DB] Buscando notas para matrícula: "${matriculaStr}" (tipo: ${typeof matriculaStr})`);
    
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.matricula = @matricula',
      parameters: [
        { name: '@matricula', value: matriculaStr }
      ]
    };

    const { resources } = await notasContainer.items
      .query(querySpec)
      .fetchAll();

    console.log(`📋 Notas médicas encontradas para matrícula ${matriculaStr}:`, resources.length);
    if (resources.length > 0) {
      console.log(`📄 [DB] Primera nota encontrada:`, JSON.stringify(resources[0], null, 2));
    }
    
    // Ordenar en memoria por fecha (más flexible que ORDER BY en query)
    // Busca múltiples campos de fecha posibles
    const sortedResources = resources.sort((a, b) => {
      const getFecha = (nota) => {
        const fechaStr = nota.fecha || nota.fechaConsulta || nota.createdAt || nota._ts;
        try {
          return new Date(fechaStr).getTime();
        } catch {
          return 0;
        }
      };
      return getFecha(b) - getFecha(a); // DESC (más reciente primero)
    });
    
    return sortedResources.map(cleanCosmosDocument);
  } catch (error) {
    console.error('Error buscando notas médicas:', error);
    throw error;
  }
}

/**
 * Eliminar una cita por ID
 * @param {string} citaId - ID de la cita
 * @param {string} matricula - Matrícula del usuario (para partition key)
 * @returns {Promise<boolean>} - true si se eliminó correctamente
 */
async function deleteCitaById(citaId, matricula) {
  try {
    // En Cosmos DB, el partition key es necesario para eliminar
    await citasContainer.item(citaId, matricula).delete();
    console.log(`✅ Cita ${citaId} eliminada correctamente`);
    return true;
  } catch (error) {
    if (error.code === 404) {
      console.log(`⚠️ Cita ${citaId} no encontrada (ya eliminada)`);
      return true; // Consideramos éxito si ya no existe
    }
    console.error(`❌ Error eliminando cita ${citaId}:`, error);
    throw error;
  }
}

/**
 * Buscar alebrije por matrícula
 * @param {string} matricula - Matrícula del estudiante
 * @returns {Object|null} - Alebrije o null si no existe
 */
async function findAlebrijeByMatricula(matricula) {
  try {
    const matriculaStr = String(matricula);
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.matricula = @matricula',
      parameters: [
        { name: '@matricula', value: matriculaStr }
      ]
    };

    const { resources } = await alebrijesContainer.items.query(querySpec).fetchAll();
    return resources.length > 0 ? cleanCosmosDocument(resources[0]) : null;
  } catch (error) {
    console.error(`❌ Error buscando alebrije para matrícula ${matricula}:`, error);
    throw error;
  }
}

/**
 * Crear un nuevo alebrije
 * @param {string} matricula - Matrícula del estudiante
 * @param {string} especieBase - Especie base (jaguar, aguila, etc.)
 * @param {string} nombre - Nombre personalizado (opcional)
 * @returns {Object} - Alebrije creado
 */
async function createAlebrije(matricula, especieBase, nombre = null) {
  try {
    const matriculaStr = String(matricula);
    const timestamp = new Date().toISOString();
    const id = `alebrije_${matriculaStr}_${Date.now()}`;

    // Generar DNA aleatorio del alebrije
    const dna = generarDNAAleatorio(especieBase);

    const alebrije = {
      id,
      matricula: matriculaStr,
      nombre: nombre || `Alebrije de ${especieBase}`,
      dna,
      estado: {
        hambre: 100,
        felicidad: 100,
        salud: 100,
        energia: 100,
        ultimaAlimentacion: timestamp,
        ultimaInteraccion: timestamp,
        ultimoCuidado: timestamp,
        diasConsecutivos: 1
      },
      historialEvoluciones: [
        {
          nivel: 1,
          fecha: timestamp,
          descripcion: 'Nacimiento del alebrije'
        }
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
      nivelEvolucion: 1,
      puntosExperiencia: 0
    };

    const { resource } = await alebrijesContainer.items.create(alebrije);
    return cleanCosmosDocument(resource);
  } catch (error) {
    console.error(`❌ Error creando alebrije para matrícula ${matricula}:`, error);
    throw error;
  }
}

/**
 * Actualizar alebrije
 * @param {string} matricula - Matrícula del estudiante
 * @param {Object} updates - Campos a actualizar
 * @returns {Object} - Alebrije actualizado
 */
async function updateAlebrije(matricula, updates) {
  try {
    const alebrije = await findAlebrijeByMatricula(matricula);
    if (!alebrije) return null;

    const alebrijeActualizado = {
      ...alebrije,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const { resource } = await alebrijesContainer.item(alebrije.id, alebrije.matricula).replace(alebrijeActualizado);
    return cleanCosmosDocument(resource);
  } catch (error) {
    console.error(`❌ Error actualizando alebrije para matrícula ${matricula}:`, error);
    throw error;
  }
}

/**
 * Registrar interacción con el alebrije
 * @param {string} matricula - Matrícula del estudiante
 * @param {string} tipo - Tipo de interacción (alimentar, jugar, curar, descansar)
 * @param {number} cantidad - Cantidad de puntos/efecto
 */
async function recordInteraction(matricula, tipo, cantidad) {
  try {
    const alebrije = await findAlebrijeByMatricula(matricula);
    if (!alebrije) throw new Error('Alebrije no encontrado');

    const timestamp = new Date().toISOString();
    let nuevoEstado = { ...alebrije.estado };

    // Aplicar efectos de la interacción
    switch (tipo) {
      case 'alimentar':
        nuevoEstado.hambre = Math.min(100, nuevoEstado.hambre + (cantidad || 20));
        nuevoEstado.felicidad = Math.min(100, nuevoEstado.felicidad + Math.floor((cantidad || 20) * 0.3));
        nuevoEstado.ultimaAlimentacion = timestamp;
        break;
      case 'jugar':
        nuevoEstado.hambre = Math.max(0, nuevoEstado.hambre - 10);
        nuevoEstado.felicidad = Math.min(100, nuevoEstado.felicidad + 20);
        nuevoEstado.salud = Math.min(100, nuevoEstado.salud + 5);
        nuevoEstado.energia = Math.max(0, nuevoEstado.energia - 15);
        break;
      case 'curar':
        nuevoEstado.salud = Math.min(100, nuevoEstado.salud + (cantidad || 30));
        nuevoEstado.felicidad = Math.min(100, nuevoEstado.felicidad + Math.floor((cantidad || 30) * 0.2));
        nuevoEstado.energia = Math.min(100, nuevoEstado.energia + Math.floor((cantidad || 30) * 0.5));
        nuevoEstado.ultimoCuidado = timestamp;
        break;
      case 'descansar':
        nuevoEstado.hambre = Math.max(0, nuevoEstado.hambre - 5);
        nuevoEstado.felicidad = Math.min(100, nuevoEstado.felicidad + 10);
        nuevoEstado.salud = Math.min(100, nuevoEstado.salud + 5);
        nuevoEstado.energia = 100;
        break;
    }

    nuevoEstado.ultimaInteraccion = timestamp;

    await updateAlebrije(matricula, { estado: nuevoEstado });
    console.log(`✅ Interacción ${tipo} registrada para alebrije de matrícula ${matricula}`);
  } catch (error) {
    console.error(`❌ Error registrando interacción para matrícula ${matricula}:`, error);
    throw error;
  }
}

/**
 * Generar DNA aleatorio para un alebrije
 * @param {string} especieBase - Especie base
 * @returns {Object} - DNA del alebrije
 */
function generarDNAAleatorio(especieBase) {
  const seed = Math.floor(Math.random() * 1000000);
  
  // Colores mexicanos vibrantes
  const coloresMexicanos = [
    '#FF6B35', '#F7931E', '#C1272D', '#8B1538',
    '#1565C0', '#00A8E8', '#7209B7', '#F72585',
    '#06FFA5', '#FFD700'
  ];
  
  const coloresShuffled = [...coloresMexicanos].sort(() => Math.random() - 0.5);
  
  const patronesDisponibles = ['espirales', 'ondas', 'zigzag', 'puntos', 'rayas', 'grecas', 'flores', 'estrellas'];
  const numPatrones = 2 + Math.floor(Math.random() * 3);
  const patronesSeleccionados = patronesDisponibles.sort(() => Math.random() - 0.5).slice(0, numPatrones);

  return {
    especieBase,
    genCabeza: generarGenCabeza(especieBase),
    genCuerpo: generarGenCuerpo(especieBase),
    genExtremidades: generarGenExtremidades(especieBase),
    genCola: generarGenCola(especieBase),
    genAlas: generarGenAlas(especieBase),
    colores: {
      colorPrimario: coloresShuffled[0],
      colorSecundario: coloresShuffled[1],
      colorTerciario: coloresShuffled[2],
      colorAcento: coloresShuffled[3],
      brillantez: 0.6 + Math.random() * 0.4
    },
    patronesGeometricos: patronesSeleccionados
  };
}

function generarGenCabeza(especieBase) {
  const formas = {
    jaguar: ['felina', 'misteriosa'],
    aguila: ['aviar', 'majestuosa'],
    serpiente: ['reptil', 'alargada'],
    venado: ['cervido', 'elegante'],
    colibri: ['pequena', 'delicada']
  };
  const formasEspecie = formas[especieBase] || ['felina', 'aviar', 'reptil'];
  
  return {
    forma: formasEspecie[Math.floor(Math.random() * formasEspecie.length)],
    orejas: ['puntiagudas', 'redondeadas', 'largas', 'ausentes'][Math.floor(Math.random() * 4)],
    cuernos: ['ausentes', 'ramificados', 'espirales', 'pequenos'][Math.floor(Math.random() * 4)],
    ojos: ['grandes', 'rasgados', 'brillantes', 'misteriosos'][Math.floor(Math.random() * 4)]
  };
}

function generarGenCuerpo(especieBase) {
  return {
    tamano: ['pequeno', 'mediano', 'grande'][Math.floor(Math.random() * 3)],
    textura: especieBase === 'serpiente' ? 'escamas' : especieBase === 'aguila' || especieBase === 'colibri' ? 'plumas' : 'pelo',
    forma: ['compacto', 'alargado', 'robusto', 'esbelto'][Math.floor(Math.random() * 4)],
    proporcion: 0.7 + Math.random() * 1.3
  };
}

function generarGenExtremidades(especieBase) {
  let numeroPatas = 4;
  if (especieBase === 'serpiente') numeroPatas = 0;
  if (especieBase === 'aguila' || especieBase === 'colibri') numeroPatas = 2;
  
  return {
    numeroPatas,
    tipo: ['garras', 'pezunas', 'dedos'][Math.floor(Math.random() * 3)],
    tamano: ['pequenas', 'medianas', 'grandes', 'poderosas'][Math.floor(Math.random() * 4)]
  };
}

function generarGenCola(especieBase) {
  return {
    tiene: especieBase !== 'colibri' || Math.random() > 0.5,
    tipo: ['larga', 'corta', 'plumosa', 'escamosa', 'espiral'][Math.floor(Math.random() * 5)],
    punta: ['normal', 'mechon', 'aguijon', 'plumas'][Math.floor(Math.random() * 4)]
  };
}

function generarGenAlas(especieBase) {
  let tiene = false;
  if (especieBase === 'aguila' || especieBase === 'colibri') tiene = true;
  else tiene = Math.random() < 0.4;
  
  return {
    tiene,
    tipo: ['plumas', 'membrana', 'energia', 'cristal'][Math.floor(Math.random() * 4)],
    tamano: ['pequenas', 'medianas', 'grandes', 'majestuosas'][Math.floor(Math.random() * 4)]
  };
}

module.exports = {
  connectToCosmosDB,
  findCarnetByEmailAndMatricula,
  findCarnetByMatricula,
  findCitasByMatricula,
  deleteCitaById,
  findPromocionesByMatricula,
  registrarClickPromocion,
  cleanCosmosDocument,
  getCosmosContainer,
  // Funciones de usuarios
  findUsuarioByMatricula,
  findUsuarioByCorreo,
  createUsuario,
  // Funciones de notas médicas
  findNotasMedicasByMatricula,
  // Funciones de alebrijes
  findAlebrijeByMatricula,
  createAlebrije,
  updateAlebrije,
  recordInteraction,
  // Exportar clientes para uso directo si es necesario
  getCosmosClient: () => cosmosClient,
  getDatabase: () => database,
  getCarnetsContainer: () => carnetsContainer,
  getCitasContainer: () => citasContainer,
  getPromocionesContainer: () => promocionesContainer,
  getUsuariosContainer: () => usuariosContainer,
  getAlebrijesContainer: () => alebrijesContainer
};