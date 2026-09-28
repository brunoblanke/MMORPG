// iniciar.js

// Sobe o jogo (server.js, porta 8000: jogo, editor e mapa) e o gerador de
// sprites (gerador/server.js, porta 8100) no mesmo processo. Os dois continuam
// programas separados; este arquivo só carrega um e outro. Quem roda é o
// gerador/iniciar-gerador.bat.

require('./server.js');
require('./gerador/server.js');
