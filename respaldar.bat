@echo off
setlocal
rem =====================================================================
rem  RESPALDO DE LA BASE DE DATOS DEL MUSEO  (doble clic)
rem  Guarda una copia con fecha y hora en la carpeta "respaldos".
rem  Este archivo va en la carpeta principal del proyecto, junto a "server".
rem  Antes: XAMPP debe estar abierto y MySQL en verde (Start).
rem =====================================================================

rem --- Cambia estas lineas solo si hace falta ---
set "MYSQLDUMP=C:\xampp\mysql\bin\mysqldump.exe"
set "BASE=museo_recuze_db"
set "USUARIO=root"
rem Si el usuario tiene clave, escribela aqui (evita simbolos como & % ^ ! en la clave):
set "CLAVE="

set "CARPETA=%~dp0respaldos"
set "OPCION_CLAVE="
if not "%CLAVE%"=="" set "OPCION_CLAVE=--password=%CLAVE%"

if not exist "%MYSQLDUMP%" (
    echo No encuentro mysqldump en: %MYSQLDUMP%
    echo Revisa que XAMPP este instalado en C:\xampp o corrige la linea MYSQLDUMP de este archivo.
    pause
    exit /b 1
)

if not exist "%CARPETA%" mkdir "%CARPETA%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "SELLO=%%i"
set "ARCHIVO=%CARPETA%\museo_%SELLO%.sql"

echo Creando respaldo de %BASE% ...
"%MYSQLDUMP%" --user=%USUARIO% %OPCION_CLAVE% --default-character-set=utf8mb4 --single-transaction --result-file="%ARCHIVO%" %BASE%
if errorlevel 1 (
    echo.
    echo ERROR: no se pudo crear el respaldo.
    echo Revisa que MySQL este iniciado en XAMPP y que el usuario y la clave sean correctos.
    if exist "%ARCHIVO%" del "%ARCHIVO%"
    pause
    exit /b 1
)

rem Un respaldo vacio o diminuto no sirve: se avisa
set "TAM=0"
for %%A in ("%ARCHIVO%") do set "TAM=%%~zA"
if %TAM% LSS 2000 (
    echo.
    echo ATENCION: el archivo quedo muy pequeno ^(%TAM% bytes^). No lo uses como respaldo.
    pause
    exit /b 1
)

echo.
echo LISTO. Respaldo guardado en:
echo   %ARCHIVO%
echo Tamano: %TAM% bytes
echo.
echo Copia esta carpeta a un USB de vez en cuando: si el computador falla, el respaldo en el mismo equipo se pierde con el.
explorer "%CARPETA%"
pause
