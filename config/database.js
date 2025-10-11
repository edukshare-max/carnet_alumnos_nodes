const { CosmosClient } = require('@azure/cosmos');

let cosmosClient;
let database;
let carnetsContainer;
let citasContainer;
let promocionesContainer;

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

    // Verificar que los contenedores existen
    const { container: carnetsResponse } = await carnetsContainer.read();
    const { container: citasResponse } = await citasContainer.read();
    const { container: promocionesResponse } = await promocionesContainer.read();
    
    console.log(`📦 Contenedor carnets: ${carnetsResponse.id}`);
    console.log(`📦 Contenedor citas: ${citasResponse.id}`);
    console.log(`📦 Contenedor promociones: ${promocionesResponse.id}`);

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
 * - Son para la matrícula específica (matricula = "15662" por ejemplo)
 * - O son para todos (matricula es null, undefined o no existe)
 * @param {string} matricula - Matrícula del usuario
 * @returns {Array} - Array de promociones aplicables al usuario
 */
async function findPromocionesByMatricula(matricula) {
  try {
    const querySpec = {
      query: `
        SELECT * FROM c 
        WHERE c.autorizado = true 
        AND (
          c.destinatario = "general"
          OR (c.destinatario = "alumno" AND c.matricula = @matricula)
          OR (c.destinatario = "alumno" AND (NOT IS_DEFINED(c.matricula) OR c.matricula = "" OR c.matricula = null))
        )
        ORDER BY c.createdAt DESC
      `,
      parameters: [
        { name: '@matricula', value: matricula }
      ]
    };

    const { resources } = await promocionesContainer.items.query(querySpec).fetchAll();
    
    console.log(`🔍 Query ejecutada para matrícula: ${matricula}`);
    console.log(`📊 Promociones encontradas: ${resources.length}`);
    
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

module.exports = {
  connectToCosmosDB,
  findCarnetByEmailAndMatricula,
  findCarnetByMatricula,
  findCitasByMatricula,
  findPromocionesByMatricula,
  registrarClickPromocion,
  cleanCosmosDocument,
  getCosmosContainer,
  // Exportar clientes para uso directo si es necesario
  getCosmosClient: () => cosmosClient,
  getDatabase: () => database,
  getCarnetsContainer: () => carnetsContainer,
  getCitasContainer: () => citasContainer,
  getPromocionesContainer: () => promocionesContainer
};