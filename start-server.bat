@echo off
rem Sobe o jogo (http://localhost:8000) e o gerador (http://localhost:8100) juntos.
rem Mudanças de código e do gerador só valem depois de reiniciar o servidor;
rem o mapa salvo no editor já vale no jogo na hora.
cd /d "%~dp0"
node iniciar.js
pause
