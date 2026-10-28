// iniciar.js

// Sobe o jogo (server.js, porta 8000: jogo, editor e mapa) e o gerador de
// sprites (gerador/server.js, porta 8100) no mesmo processo. Os dois continuam
// programas separados; este arquivo só carrega um e outro. Quem roda é o
// start-server.bat, na raiz. Se falta alguma biblioteca do package.json (depois
// de um git pull que trouxe uma nova), roda o npm install antes.

const { execSync } = require('child_process');
const dependencias = Object.keys(require('./package.json').dependencies || {});

// ================================================================================================================================================================================================================================================
// falta

function falta(nome) {
  try {
    require.resolve(nome);
    return false;
  } catch {
    return true;
  }
}

if (dependencias.some(falta)) {
  console.log('📦 Instalando as bibliotecas que faltam (npm install)...');
  execSync('npm install --omit=dev', { cwd: __dirname, stdio: 'inherit' });
}

require('./server.js');
require('./gerador/server.js');
