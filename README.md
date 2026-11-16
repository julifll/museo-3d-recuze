# Museo 3D ReCuZe

Museo virtual y físico de la cultura Zenú (Resguardo Indígena Zenú, Córdoba), hecho para una escuela rural **sin internet**. Los estudiantes escanean el código QR de una réplica impresa en 3D, leen su ficha, ven su video y ganan puntos por descubrir piezas. Todo funciona dentro de una red local: un portátil hace de servidor, un router reparte el Wi-Fi y los celulares y el quiosco se conectan a él.

> Proyecto de formación — Tecnología en Análisis y Desarrollo de Software (SENA), macroproyecto escolar.
> Autora: Juliana Florez Llorente · Instructor/a: Luis Edilberto Díaz · Ficha: 2977344

---

## 1. ¿Qué hace el museo?

| Parte | Para qué sirve | Dirección |
|---|---|---|
| **Quiosco** | Pantalla del museo. Allí el estudiante se registra, elige su apodo y consulta **Mi recorrido** (sus puntos, su posición y las piezas que ya descubrió). | `/quiosco/` |
| **Galería y Bóveda Zenú** | Se abre desde el celular al escanear el QR de una pieza. Muestra la ficha y, con el documento del estudiante, registra el descubrimiento y suma puntos. | `/galeria/` |
| **Contenido** | Fotos y videos de las piezas. | `/contenido/` |
| **Administración** | Panel mínimo para quien cuida el museo: cambiar puntos de una pieza, cambiar la contraseña de un estudiante, desbloquear, borrar datos al cierre. Solo se abre desde el portátil servidor. | `/admin/` |

### Cómo es la experiencia del estudiante

1. **Se registra** en el quiosco con nombre, apellido, lugar de residencia, edad, documento, grado y autorización de datos. El correo es opcional (muchos niños no tienen).
2. El servidor le propone **tres apodos** (un animal y una cualidad, por ejemplo *Oso hormiguero Curioso*) y elige uno. Los apodos no se repiten.
3. Crea una **contraseña de 4 a 8 caracteres**.
4. **Mi recorrido** (en el quiosco): ingresa con documento y contraseña y ve su apodo, sus puntos, su posición en su grado, las piezas descubiertas (con ficha y video) y las que le faltan.
5. **Bóveda Zenú** (en la galería): escanea el QR de una pieza, escribe su documento y el código de la pieza, y gana puntos. No pide contraseña a propósito: es rápido para niños de 3.º a 11.º. Es un riesgo conocido y aceptado (ver sección 9).
6. El **ranking** muestra solo apodo y grado, nunca nombres reales.

---

## 2. Cómo está armado (arquitectura sencilla)

```
 Celulares y quiosco  ──Wi-Fi──►  Router (192.168.0.1)  ──►  Portátil servidor (192.168.0.200)
                                                                 │
                                                       Node.js + Express  (puerto 3000)
                                                       sirve las páginas y la API
                                                                 │
                                                       MariaDB (XAMPP): museo_recuze_db
```

Un solo programa (Express) entrega las páginas **y** responde a la API, así que todo sale del mismo origen y las rutas son relativas (`/api/...`). No hay internet, ni CDN, ni servicios externos: las fuentes, íconos e imágenes viajan dentro del proyecto.

### Tecnologías reales

- **Frontend:** HTML, CSS y JavaScript puros (sin frameworks).
- **Servidor:** Node.js (versión 20 o superior; probado con 24) y Express 5.
- **Base de datos:** MariaDB 10.4 (incluida en XAMPP), con `mysql2`.
- **Seguridad:** `bcrypt` para contraseñas, `dotenv` para secretos.
- **QR:** paquete `qrcode`, solo para generar la hoja imprimible.

---

## 3. Estructura de carpetas

```
museo_recuze/
├── appquiosco/          Pantalla del quiosco (index.html, css/, js/)
├── galeria-web/         Galería y Bóveda Zenú
├── admin/               Panel de administración
├── contenido/           Imágenes y videos de las piezas
├── server/
│   ├── server.js        Arranque, rutas y API pública
│   ├── admin.js         API y protección del panel de administración
│   ├── validaciones.js  Reglas de los datos que llegan al servidor
│   ├── apodos.js        Generador de apodos (animal + cualidad)
│   ├── limiteIntentos.js  Bloqueo temporal tras varios intentos fallidos
│   ├── db.js            Conexión a la base de datos
│   ├── scripts/generar_qr.js   Crea la hoja de QR para imprimir
│   ├── .env             Secretos (NO se sube a Git)
│   └── package.json
├── respaldos/           Copias de la base (NO se sube a Git)
├── qr/                  Hoja de QR generada (NO se sube a Git)
├── iniciar_museo.bat    Enciende el servidor (con reinicio automático)
├── respaldar.bat        Guarda una copia de la base de datos
└── restaurar.bat        Devuelve la base a una copia anterior
```

---

## 4. Requisitos

- Windows con **Node.js LTS** (nodejs.org).
- **XAMPP** con MySQL/MariaDB (instalado en `C:\xampp`).
- Un navegador moderno (Chrome, Edge, Firefox).
- Internet **solo para instalar** paquetes la primera vez; después el museo funciona sin él.

---

## 5. Instalación paso a paso

1. **Copia el proyecto** a una carpeta sencilla, por ejemplo `C:\museo_recuze`.
2. **Instala los paquetes** (con internet), en la carpeta `server`:
   ```
   npm install
   npm install qrcode
   ```
3. **Crea la base de datos.** En phpMyAdmin crea una base vacía llamada `museo_recuze_db` (cotejamiento `utf8mb4_general_ci`). Luego importa tu respaldo (con `restaurar.bat`) o ejecuta los scripts SQL del proyecto.
4. **Crea el usuario de la aplicación** en MySQL (`museo_app`) con permisos solo sobre `museo_recuze_db`. No uses `root` para la aplicación.
5. **Crea el archivo `server/.env`** copiando `.env.example` y cambiando las claves:

   | Variable | Qué es |
   |---|---|
   | `PORT` | Puerto del servidor (3000). |
   | `DB_HOST` | Dónde está la base (`localhost`). |
   | `DB_USER` / `DB_PASSWORD` | Usuario y clave de la aplicación. |
   | `DB_NAME` | `museo_recuze_db`. |
   | `ADMIN_CLAVE` | Clave del panel de administración (mínimo 8 caracteres). Sin ella, el panel queda apagado. |

6. **Enciende el servidor:** doble clic en `iniciar_museo.bat`, o desde `server`: `npm start` (o `npm run dev` para desarrollar con reinicio automático).
7. **Prueba** en el navegador del mismo portátil: `http://localhost:3000/quiosco/`.

> Importante: abre siempre el museo por `http://localhost:3000/...` (o la IP del servidor), **no** con extensiones como Live Server: la API solo existe en el puerto 3000.

---

## 6. Despliegue en el colegio

El portátil del colegio es el servidor. Se prepara una vez, ya conectado al router del museo:

1. **IP fija.** En Windows: Configuración de red → Wi-Fi → Propiedades → Asignación de IP manual.
   IP `192.168.0.200`, máscara `255.255.255.0`, puerta de enlace `192.168.0.1`. Esa IP queda fuera del rango que el router reparte (.10 a .128).
2. **Firewall.** Permitir el puerto `3000` de entrada, perfil **Privado**, para que los celulares lleguen al servidor.
3. **MySQL como servicio** en XAMPP, para que arranque con el equipo.
4. **Arranque automático.** Un acceso directo de `iniciar_museo.bat` en `shell:startup`. En energía: nunca suspender con la corriente conectada.
5. **Genera los QR con la IP definitiva** (ver sección 7), imprímelos y pégalos junto a cada pieza.
6. **Prueba con celulares reales.** Apaga los datos móviles: Android abandona los Wi-Fi sin internet si tiene otra opción. Conéctate al Wi-Fi del museo y abre `http://192.168.0.200:3000/galeria/`.

Los datos del router, el procedimiento completo y qué hacer si se reinicia de fábrica están en el **Anexo del router** del Informe técnico.

---

## 7. Códigos QR

Cada QR contiene la dirección completa con la IP del servidor:

```
http://192.168.0.200:3000/galeria/?pieza=AVE-47#boveda-zenu
```

Por eso **se generan con la IP definitiva**. Desde la carpeta `server`:

```
node scripts/generar_qr.js 192.168.0.200
```

Se crea `qr/hoja-qr.html` con un QR por pieza activa, su nombre y, debajo, el código escrito en grande por si el QR no se puede escanear. Ábrela en el navegador e imprímela (Ctrl + P, tamaño real 100 %). Si la IP cambia, hay que generarlos e imprimirlos de nuevo.

---

## 8. Respaldos y mantenimiento

- **Respaldar:** doble clic en `respaldar.bat`. Guarda `respaldos\museo_FECHA.sql`. Copia esa carpeta a un USB de vez en cuando: un respaldo en el mismo equipo se pierde si el equipo falla.
- **Restaurar:** arrastra el `.sql` sobre `restaurar.bat` y confirma. Reemplaza **todos** los datos actuales. La base debe existir (vacía) y el usuario `museo_app` se crea aparte, porque los usuarios de MySQL no viajan en el respaldo.
- **Cambiar la ficha de una pieza:** en phpMyAdmin, tabla `pieza3d`, fila con `codigo_qr = 'TUB-19'` (por ejemplo). Se guarda y se ve al recargar la página; no hay que reiniciar el servidor. No vuelvas a ejecutar `seed_piezas.sql` sobre la base en uso: la reemplazaría.
- **Puntos de cada pieza:** hoy 50 puntos por pieza activa. Se cambian desde el panel `/admin/` o con `UPDATE` en la tabla `pieza3d`. Una pieza con `suma_puntos = 0` solo muestra su ficha y no guarda registro.
- **Fin del año escolar:** desde el panel, reiniciar puntos o borrar visitantes (pide escribir `REINICIAR` o `BORRAR` para confirmar).
- **Fuentes del Museo del Oro:** los PDF no se agregan al sistema. Se pasa su texto a los campos de la ficha y se cita en el campo `fuente`. Guárdalos en una carpeta `referencias/` fuera del proyecto.

---

## 9. Seguridad y privacidad (en palabras simples)

**Lo que sí se hizo**

- El servidor valida **todo** lo que llega; no confía en el navegador.
- Las consultas a la base van parametrizadas (no se pueden "inyectar" instrucciones SQL).
- Las contraseñas se guardan cifradas con bcrypt, nunca en texto.
- Los puntos los calcula el servidor; el navegador no puede inventarlos.
- Tras 5 intentos fallidos con un mismo documento (o en el panel de administración), hay bloqueo de 5 minutos.
- El panel de administración tiene tres capas: solo responde en el mismo portátil, pide la clave `ADMIN_CLAVE` y limita los intentos.
- Las páginas muestran los datos con `textContent`, no con `innerHTML`, para evitar que alguien escriba código en su nombre.

**Datos de menores (Ley 1581 de 2012)**

- Se pide solo lo necesario, con autorización del acudiente.
- El ranking y las pantallas públicas usan **apodo**, no nombre.
- Los datos se borran al cierre del proyecto o del año escolar.
- Falta firmar el aviso de privacidad con rectoría (ver pendientes).

**Limitaciones conocidas**

- La red usa `http`, sin cifrado. Es aceptable en una red local cerrada, pero hay que decirlo.
- **Bóveda Zenú** pide solo el documento: alguien que conozca el número de otro estudiante podría sumarle puntos de piezas. Los puntos son un juego, no una calificación. Se aceptó este riesgo para que el recorrido sea ágil, y se documenta.
- Si los celulares tienen datos móviles activos, pueden salirse del Wi-Fi del museo.

---

## 10. Pruebas realizadas

Se probaron, con resultado exitoso: registro (apodo, errores y duplicados), ingreso y bloqueo por intentos, descubrimiento de piezas y puntos, ranking, Mi recorrido, Bóveda con QR desde celular, panel de administración (incluido el bloqueo con 403 desde otro dispositivo), respaldo y restauración, y generación de QR.

Pendiente: prueba general con varios celulares a la vez en la red del colegio.

---

## 11. Si algo falla

| Síntoma | Qué revisar |
|---|---|
| El celular no abre la página | ¿Está en el Wi-Fi del museo y con datos móviles apagados? ¿El servidor está encendido? ¿Regla del firewall (puerto 3000, perfil Privado)? ¿La IP sigue siendo `192.168.0.200`? |
| "No se pudo conectar con el servidor" en el quiosco | ¿Se abrió por `localhost:3000` y no por Live Server? |
| Error de base de datos al iniciar | ¿MySQL está en verde en XAMPP? ¿Coinciden usuario y clave del `.env`? |
| `/admin/` responde 403 | Es lo esperado fuera del portátil servidor. |
| El QR no abre la pieza | Se generó con otra IP. Genera e imprime de nuevo. |
| No recuerdo la clave del Wi-Fi | Se recupera desde el router o se reconfigura (Anexo del router). |

---

## 12. Trabajo futuro

- Editar fichas y dar de alta piezas desde el panel (hoy se hace en phpMyAdmin).
- Historia y audio de las piezas en lengua y voz de la comunidad.
- Google Sites solo como vitrina informativa pública y aparte; no reemplaza este sistema.
- Fichas pendientes (TUB-19 y otras) según el docente y las fuentes.

---

## 13. Créditos y licencias

- Cultura y piezas: Resguardo Indígena Zenú. Fichas basadas en el Museo del Oro (Banco de la República), citadas en el campo `fuente` de cada pieza.
- Modelos 3D: autor y licencia *[por completar]*.
- Autorización de imagen y voz de quienes aparecen en los videos: *[por completar]*.
- Licencia del código: *[por definir con el SENA / la institución]*.
