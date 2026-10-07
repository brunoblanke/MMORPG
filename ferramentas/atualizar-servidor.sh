#!/bin/bash
# ferramentas/atualizar-servidor.sh

# ================================================================================================================================================================================================================================================
# atualizar-servidor
# Roda no servidor a cada minuto (jogo-atualizar.timer): se o main do GitHub mudou, baixa o código novo,
# instala as dependências se preciso e reinicia o jogo. Os dados (mapa, personagens, casas, senhas) ficam
# fora do repositório, em /home/opc/dados, e nunca são tocados.

cd /home/opc/jogo || exit 1
git fetch -q origin main || exit 1
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && exit 0
LOCK_ANTES=$(git rev-parse HEAD:package-lock.json 2>/dev/null)
git reset -q --hard origin/main || exit 1
LOCK_DEPOIS=$(git rev-parse HEAD:package-lock.json 2>/dev/null)
[ "$LOCK_ANTES" != "$LOCK_DEPOIS" ] && npm install --omit=dev --silent
sudo systemctl restart jogo
echo "Atualizado para $(git rev-parse --short HEAD)"
