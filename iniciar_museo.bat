@echo off
setlocal
title Servidor del Museo 3D ReCuZe
rem =====================================================================
rem  INICIAR EL SERVIDOR DEL MUSEO  (doble clic)
rem  Va en la carpeta principal del proyecto, junto a "server".
rem  Antes: XAMPP con MySQL iniciado (ideal: instalado como servicio).
rem  Si el servidor se cae por cualquier motivo, se reinicia solo a los 5 segundos.
rem  Para detenerlo: cierra esta ventana.
rem =====================================================================

cd /d "%~dp0server"

where node >nul 2>nul
if errorlevel 1 (
    echo No encuentro Node.js. Instalalo desde nodejs.org ^(version LTS^) y vuelve a abrir este archivo.
    pause
    exit /b 1
)

if not exist ".env" (
    echo Falta el archivo .env en la carpeta server. Copia .env.example como .env y completa las claves.
    pause
    exit /b 1
)

:inicio
echo.
echo [%date% %time%] Iniciando el servidor del museo...
node server.js
echo.
echo [%date% %time%] El servidor se detuvo. Reiniciando en 5 segundos... ^(cierra esta ventana para parar^)
timeout /t 5 /nobreak >nul
goto inicio
