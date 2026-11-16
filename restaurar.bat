@echo off
setlocal
rem =====================================================================
rem  RESTAURAR UN RESPALDO  (arrastra el archivo .sql sobre este archivo)
rem  Reemplaza TODOS los datos actuales de la base por los del respaldo.
rem  Si no estas segura, primero haz doble clic en respaldar.bat.
rem =====================================================================

set "MYSQL=C:\xampp\mysql\bin\mysql.exe"
set "BASE=museo_recuze_db"
set "USUARIO=root"
rem Si el usuario tiene clave, escribela aqui (evita simbolos como & % ^ ! en la clave):
set "CLAVE="

set "OPCION_CLAVE="
if not "%CLAVE%"=="" set "OPCION_CLAVE=--password=%CLAVE%"

if "%~1"=="" (
    echo Arrastra un archivo .sql de la carpeta "respaldos" y sueltalo sobre este archivo.
    pause
    exit /b 1
)
if not exist "%~1" (
    echo No encuentro el archivo: %~1
    pause
    exit /b 1
)
if not exist "%MYSQL%" (
    echo No encuentro mysql en: %MYSQL%
    echo Revisa que XAMPP este instalado en C:\xampp o corrige la linea MYSQL de este archivo.
    pause
    exit /b 1
)

echo ATENCION: se reemplazaran TODOS los datos actuales de la base %BASE% por los de:
echo   %~1
echo.
choice /c SN /m "Continuar (S = si, N = no)"
if errorlevel 2 (
    echo No se cambio nada.
    pause
    exit /b 0
)

"%MYSQL%" --user=%USUARIO% %OPCION_CLAVE% --default-character-set=utf8mb4 %BASE% < "%~1"
if errorlevel 1 (
    echo.
    echo ERROR: no se pudo restaurar. Revisa que MySQL este iniciado en XAMPP.
    pause
    exit /b 1
)

echo.
echo LISTO. La base se restauro. Reinicia el servidor del museo si estaba encendido.
pause
