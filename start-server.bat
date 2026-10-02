@echo off
rem Sobe o jogo (http://localhost:8000) e o gerador (http://localhost:8100) juntos.
rem Com --watch, o servidor reinicia sozinho quando um arquivo de código muda
rem (depois de um git pull, por exemplo); mapa e gerador já recarregam sem isso.
cd /d "%~dp0"
node --watch --watch-preserve-output iniciar.js
pause
