#!/usr/bin/env node

console.log('🔍 DIAGNÓSTICO DEL BACKEND SASU');
console.log('================================');

// Verificar Node.js
console.log(`📋 Node.js: ${process.version}`);
console.log(`📋 NPM: ${process.env.npm_version || 'no disponible'}`);
console.log(`📋 Platform: ${process.platform}`);
console.log(`📋 Arch: ${process.arch}`);

// Verificar variables de entorno críticas
console.log('\n🔧 VARIABLES DE ENTORNO:');
const requiredEnvs = [
  'NODE_ENV',
  'PORT',
  'COSMOS_ENDPOINT',
  'COSMOS_KEY',
  'COSMOS_DATABASE',
  'JWT_SECRET'
];

let allEnvsPresent = true;
requiredEnvs.forEach(env => {
  const value = process.env[env];
  if (value) {
    console.log(`✅ ${env}: ${env.includes('KEY') || env.includes('SECRET') ? '[CONFIGURADO]' : value}`);
  } else {
    console.log(`❌ ${env}: NO CONFIGURADO`);
    allEnvsPresent = false;
  }
});

// Verificar dependencias
console.log('\n📦 DEPENDENCIAS:');
try {
  const pkg = require('./package.json');
  console.log(`✅ Package.json: ${pkg.name} v${pkg.version}`);
  
  const deps = Object.keys(pkg.dependencies || {});
  console.log(`✅ Dependencias: ${deps.length} paquetes`);
  deps.forEach(dep => {
    try {
      require(dep);
      console.log(`  ✅ ${dep}`);
    } catch (e) {
      console.log(`  ❌ ${dep}: ${e.message}`);
    }
  });
} catch (e) {
  console.log(`❌ Error leyendo package.json: ${e.message}`);
}

// Verificar archivos críticos
console.log('\n📁 ARCHIVOS:');
const fs = require('fs');
const criticalFiles = [
  'index.js',
  'config/database.js',
  'routes/auth.js',
  'routes/carnet.js',
  'routes/citas.js'
];

criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file}: NO ENCONTRADO`);
  }
});

// Resultado final
console.log('\n🎯 RESULTADO:');
if (allEnvsPresent) {
  console.log('✅ El backend está listo para funcionar');
  process.exit(0);
} else {
  console.log('❌ Faltan variables de entorno críticas');
  process.exit(1);
}