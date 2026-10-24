# PENDENCIAS.md

Estado do projeto para retomar numa conversa nova. O que é regra fixa e como o código funciona está no `CLAUDE.md` (lido sozinho a cada sessão); aqui ficam as pendências, as decisões e onde parei. Sem senhas, chaves nem credenciais.

## Para o usuário fazer

- Gerador → "Gerar folhas pendentes" (Objetos e Criaturas): `banqueiro` e `capitao` (NPCs), `scythe`, `chave-dourada`, `alavanca-1` e `alavanca-1-ligada`, `amulet-of-loss`. Sem a folha (.png) o item não existe no jogo. Os ids do Tibia dessas receitas (chave 2970, alavanca 1945/1946, foice 3453, amuleto 3057) foram escolhidos de memória: conferir na primeira geração.
- Conferir que a receita `cama` tem Uso `cama` e `cama-ocupada` como desenho ativo.
- Criar o objeto de depósito (Uso `deposito`) e, se quiser testar a pick, um monte com Uso `picareta`.
- Servidor: definir `JOGO_ADMIN_SENHA` no arquivo do serviço `jogo` (sem ela o editor não salva o mapa de outro computador) e, na Oracle, reservar o IP público para ele não mudar.
- Mapa de teste: `node ferramentas/criar-mapa-teste.js` gera `TRANSF/mapa-teste.json` (cidade com todos os NPCs, torre, cavernas, cofre com chave, salas por nível e quest, alavanca, capitão de viagem). Fazer backup do mapa atual antes de copiar para `data/map.json` no servidor.
- Rodar `node ferramentas/converter-receitas.js` depois de criar receitas por script (grava slot, skillArma, transicao e colisao de parede dentro das receitas).

## Modelo de objetos (reestruturação, em andamento)

Feito: `shared/ficha.js` (ficha com traços e interações), ferramentas por capacidade (cavar, quebrar, cortar, colher, puxar, pescar, abrir), clicar e pisar pela ficha, interações escritas no gerador (Objetos, Criaturas, Pisos) rodando em `js/systems/interaction-effects.js`, pasta só organiza (receitas convertidas), editor monta o ✎ pela ficha. O artefato com as decisões marcadas: https://claude.ai/artifact/MMdLArrnAuBtpvvHEDeAFN (coleção `decisoes`).

Gerador: aba Objetos reorganizada em seções que abrem e fecham (`createSections` e `PROPERTY_GROUPS` em `gerador/app/js/objects.js`); falta o mesmo jeito em Pisos, Criaturas e Paredes (o usuário achou as abas muito diferentes entre si).

Falta, por ordem:
1. Gatilhos feitos: `ser-atingido`, `morrer`, `tempo`, `falar` (condição `palavra`) e `item-em-cima` (condição `item`, efeito `consumir-item`), em criaturas e objetos conforme faz sentido. Conversa de NPC segue por módulos.
2. (feito) Painel de Objetos mostra o que o Uso faz (`descreverUso`).
3. Player como ficha: `fichaDoPlayer(player)` (só leitura) e os gatilhos `ser-atingido`, `morrer` e `tempo` do player rodam pelas interações escritas na receita do sprite dele (`personagens/players/player-masculino` / `-feminino`, `PLAYER_SPRITES`), valem pra todos os players daquele gênero. Falta o jogo consultar a ficha em vez de ler o player direto.
4. (feito) Anel de invisibilidade (`invisivelEquipado`, `player.isInvisible`; stealth ring com Duração 1800 s) e time ring (speed 40). Falta só preencher a regeneração do life ring no gerador.
5. Id: mantido como `grupo/pasta/nome` (decisão posterior ao artefato: mover pasta usa `ferramentas/mover-folhas.js`, que atualiza tudo e a tabela `gerador/renomeados.json`).

## Decisões já tomadas (não repetir a discussão)

- Sem soul points; magias fortes limitadas por mana alta e cooldown.
- Fora de escopo: modos de ataque, chat/canais, outfit/addons, exhaust por grupo, comandos de admin, MOBA (removido do repositório).
- Segurança do servidor já feita (ver `CLAUDE.md`): arquivos protegidos, senha do editor, limites do WebSocket. Falta (não pedido): HTTPS dedicado/ proxy com limite por IP em volta, proteção contra tentativa de senha vinda de muitos IPs.

## Ideias oferecidas e não pedidas

Minimapa; som e música; respawn que espera o spawn ficar sem player por perto; eventos/invasões em horário fixo; comida/estômago e demais itens do 7.8 que ainda não existem.

## Servidor

Dados do servidor Oracle (IP, usuário, pastas, serviços, atualização automática por timer a cada minuto) estão na seção "Servidor (Oracle Cloud)" do `CLAUDE.md`.
