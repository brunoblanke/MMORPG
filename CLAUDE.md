# CLAUDE.md

Jogo multiplayer estilo Tibia em JavaScript puro (sem framework), com editor de mapa e gerador de sprites. Sprites vêm do cliente Tibia 15.01.

## Como trabalhar aqui

- Responder em português, curto e direto. Não escrever mensagens que o usuário não pediu (no jogo também: nada de avisos/textos extras).
- Trabalhar direto no `main`: `git pull -q --rebase origin main`, commit, `git push -q -u origin main`.
- Rodar `npm test` antes de cada commit e terminar a resposta com `✅ Terminado: N de N testes passando`.
- Só verificar no navegador (Playwright) quando for realmente necessário ou pedido; preferir testes automáticos.
- O usuário não pode instalar nada no PC dele. Ele edita no Windows (`D:\GIT\MMORPG`) e às vezes faz commit em paralelo: manter as versões dele em conflitos.
- Pensar em funções gerais reutilizáveis (ex.: estado normal/ativo serve pra luz, pá, porta), não casos específicos.
- Usar os itens/sprites que o usuário cria no gerador; não criar duplicatas.

## Estilo de código (obrigatório)

- Primeira linha de todo arquivo: `// caminho/nome.js`.
- Cada função com cabeçalho: uma linha `// ====...` (a mesma régua usada no código) e depois `// nomeDaFuncao`, opcionalmente seguido de comentário curto explicando o que faz.
- Sem comentários soltos dentro das funções.
- Seguir o estilo do arquivo ao redor (nomes em inglês no jogo; em português no gerador e nas ferramentas).
- Checagem de tipos (JSDoc/TS, `jsconfig.json`): não introduzir avisos novos.

## Segurança

- `sftp-config.json` tem credenciais: nunca ler, imprimir nem usar; fica no `.gitignore`.
- Não aceitar login/senha de servidor pelo chat.
- Não commitar dados de teste (`data/characters.json`, `data/houses.json`, `data/passwords.json` são ignorados).
- `gerador/tibia/atual/` (Tibia.spr + Tibia.dat, ~450 MB) nunca vai pro git.
- `TRANSF/` é só para transferir arquivos.

## Estrutura

- `server.js` — servidor do jogo (Express + WebSocket), roda a simulação; serve o jogo e o editor (`/editor/`). Lê as folhas do gerador ao iniciar (reiniciar após mudanças no gerador). Variáveis de teste: `PORT`, `JOGO_MAPA`, `JOGO_PERSONAGENS`, `JOGO_CASAS`, `JOGO_SENHAS` (senhas dos personagens, só hash; padrão `passwords.json` ao lado dos personagens; o 1º acesso de um nome define a senha dele). O mapa ao vivo é o do servidor (`JOGO_MAPA`; o navegador e o editor leem de `/api/map`, o editor salva nele e baixa com `?baixar=1`, com backup diário em `backups/`); `data/map.json` do repositório é só o mapa inicial, copiado na 1ª subida quando o arquivo ao vivo não existe.
- `js/` — jogo: `simulation.js` (autoritativa no servidor), `systems/` (combate, magias, interações, inventário…), `models/`, `net/` (protocolo, delta, sessão remota), `views/` (renderer, janelas, iluminação).
- `shared/` — usado por jogo, editor e servidor: `assets.js` (folhas do gerador, tipos `pasta/nome#peça`, direções, estado ativo, padrão de piso), `map-format.js`, `items.js`, `spells.js`, `effects.js`, `stairs.js`.
- `editor/` — editor de mapa (salva em `data/map.json`; R gira objetos; prévia do pincel; a ferramenta Bot de teste pinta players parados que renascem no lugar, `botData`).
- `gerador/` — gerador de sprites (porta `GERADOR_PORT`, padrão 8100): `server.js`, `tibia-assets.js` (lê .spr/.dat), `app/` (Pisos, Criaturas, Paredes, Objetos, Classificar). Receitas em `gerador/projetos/**.json`, folhas prontas em `gerador/saida/**.png`. `taxonomia.json` define pastas; `classificacao.json` a classificação; `itens-antigos.json` a aba Old.
- `ferramentas/` — scripts: `efeitos.js` (efeitos/projéteis), `itens-antigos.js`, `pre-classificar.js`, `mover-folhas.js`, `importar-ataques.js` (magias e resistências das criaturas, do Canary), `criar-criaturas.js` (cria as receitas das criaturas clássicas do Tibia a partir do Canary: stats, comportamento, loot, magias, resistências; as folhas saem do gerador, aba Criaturas → "Gerar folhas pendentes"), `criar-personagens-teste.js` (Druid, Paladin, Knight e Sorcerer nível 100 com senha de teste; só com o servidor parado — com ele ligado, o botão "Players de teste" do editor faz o mesmo, `POST /api/personagens-teste`, dados em `js/net/test-characters.js`).
- `moba/` — projeto paralelo, um MOBA 4×4 (knight, paladin, sorcerer, druid por time) com movimento livre, minions, torres e nexus, que reaproveita as sprites e os efeitos do jogo. Tudo dele fica nessa pasta (e `npm run moba` / `npm run moba:test`); nada do MMORPG depende dela. em `/moba` no servidor do jogo (HTTP + SSE, sem mexer no WebSocket). Mapa 120×60: lane no meio entre muros, selva em cima e embaixo com acampamentos neutros (lobo, urso, minotauro, ciclope) e os bosses Dragon e Demon (buff de 3 min pro time todo). Loja de itens (B, só na fonte; 6 espaços, poções 1-6), ultimate no R (nível 6), placar (Tab), feed e avisos. `engine/` é a simulação pura (config, mapa, heróis, habilidades, itens/loja, neutros, minions, torres, bots), `server.js` o servidor (porta `MOBA_PORT`, padrão 8300), `client/` a tela, `tests/` os testes.
- `tests/` — `node --test`; `tests/tibia-780/` é o cliente 7.80 usado nos testes e na comparação de sprites antigos.

## Conceitos importantes

- Tipo de objeto no mapa: `grupo/pasta/nome`, com peça opcional `#peça` (parede: `#porta-x`; objeto que gira: `#leste`; piso: `#meio-2`, `#padrao-1-0`).
- Objeto que gira: receita com `direcoes` (uma linha da folha por direção); objeto de 2 sqm (`formato.sqms: 2`, cama) bloqueia o 2º sqm.
- Estado normal/ativo: `ativoComo` (desenho ativo) + `comecaAtivo`; objeto fixo sem Uso alterna ao usar; sincronizado em `active`.
- Piso com padrão pela posição (`formato.padrao`), animado (`quadros`, `msPorQuadro`).
- Escadas sobem para a direção delas (`shared/stairs.js`).
- Munição: o efeito ao acertar vem da receita (`impacto` no gerador: explode em área, veneno ou dano extra de elemento), não do tipo da flecha. Arma de duas mãos (`duasMaos`) não equipa com escudo; aljava (pasta Aljavas, container) vai no espaço de munição e só guarda munição.
- Magias das criaturas: lista `ataques` na receita (tiro, bola, onda, raio, cruz, anel, redor, varredura, campo, corrente, lentidão, cura, reflexo), editada no gerador (aba Criaturas); `resistencias` = % do dano que a criatura leva por tipo (Canary: 100 − percent); `magia` antiga vira um tiro. Player ainda não tem resistência.
- Patrulha: a criatura anda até um sqm sorteado da área e, ao chegar, já sorteia o próximo (`CONFIG.patrolPauseMin/Max` = 0; mudar pra voltar a ter pausa). Criatura com `voa: true` na receita (gerador → Criaturas → Voa; `creatureFlies`) nunca para de animar a sprite, nem parada ou atacando.
- Banco e correio: NPC com `talk.banco` (gerador → Criaturas → NPC → "É banqueiro") faz saldo/depositar/sacar/transferir/trocar moedas (`player.bank`, transferência também pra personagem offline via `sim.savedCharacters`). Correio: objeto com Uso `correio` + item com propriedade `postal` (carta, encomenda); o player diz `!enviar NOME` e joga o item na caixa; vai pro depósito do destinatário, online ou guardado (`js/systems/mail.js`).
- Simulador (`/simulador.html`, link "Simulator" no editor): só visual, sem jogo por trás. Campo 20×9 de `piso-metal-1` (canvas sem escala, sqm de 32 px); quem lança (criatura `criatura` ou `player` do gerador) fica parado virado pra leste a 7 sqm da borda oeste e o alvo (criatura `dummy`, sempre) virado pra oeste a 7 da leste; o alvo só se aproxima (nunca passa de 5 sqm); beam e chain têm 2 cópias do alvo, cada uma 1 sqm a oeste (na linha, ou 1 sqm ao norte e 1 ao sul); no chain o simulador atinge todos os alvos a até 4 sqm. Formulário: Creature (forma → só os campos dela) ou Player (Spells, Runes, Ammo, Wands and Rods); Espaço lança. O que desenhar sai de `shared/spell-plan.js` (puro, testado) e das formas em `shared/spell-areas.js` (as mesmas de `systems/creature-powers.js`); tela em `js/views/spell-simulator.js`.
- Dois players só dividem o sqm no respawn e ao cair em buraco; escada de usar com alguém em cima sai no sqm livre mais perto.
- "Antigo" (aba Old) = sprite idêntico ao 7.80; o Tibia atual ainda usa muitos deles.
