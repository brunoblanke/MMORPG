// server.js

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const app = express();

const MAP_DATA_PATH = path.join(__dirname, 'data', 'map.json');
const PORT = process.env.PORT || 8000;

app.use(express.text({ type: 'text/plain', limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(liberarCors);
app.post('/api/save-map', salvarMapa);
app.use(express.static(__dirname));

iniciarServidor(app, PORT);

// ================================================================================================================================================================================================================================================
// liberarCors

function liberarCors(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}

// ================================================================================================================================================================================================================================================
// salvarMapa

function salvarMapa(req, res) {
  const mapData = req.body;
  const isValidMap = mapData && typeof mapData === 'object' &&
    Array.isArray(mapData.objetosData) &&
    Array.isArray(mapData.transicoesData) &&
    Array.isArray(mapData.enemyData);

  if (!isValidMap) {
    console.error('❌ POST /api/save-map: conteúdo não é um mapa válido');
    return res.status(400).json({ success: false, message: 'Conteúdo não é um mapa válido.' });
  }

  try {
    fs.writeFileSync(MAP_DATA_PATH, JSON.stringify(mapData, null, 2), 'utf8');
    console.log(`✅ Mapa salvo em ${MAP_DATA_PATH} (${mapData.objetosData.length} objetos)`);
    res.json({ success: true, message: 'Mapa salvo com sucesso!' });
  } catch (err) {
    console.error('❌ Erro ao salvar:', err.message);
    res.status(500).json({ success: false, message: 'Erro ao salvar: ' + err.message });
  }
}

// ================================================================================================================================================================================================================================================
// enderecosRede

function enderecosRede(porta) {
  const enderecos = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const rede of interfaces) {
      if (rede.family === 'IPv4' && !rede.internal) {
        enderecos.push(`http://${rede.address}:${porta}`);
      }
    }
  }
  return enderecos;
}

// ================================================================================================================================================================================================================================================
// iniciarServidor

function iniciarServidor(servidor, porta) {
  servidor.listen(porta, '0.0.0.0', () => {
    console.log(`\n🚀 Servidor rodando em http://localhost:${porta}`);
    for (const endereco of enderecosRede(porta)) {
      console.log(`🌐 Na rede: ${endereco}`);
    }
    console.log(`📝 Editor em: http://localhost:${porta}/editor/\n`);
  });
}