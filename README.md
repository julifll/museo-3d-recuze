# Museo 3D-ReCuZe: Sistema Offline-First para apoyo a proyecto educativo.

Sistema web desacoplado (Frontend + Backend REST + MySQL) diseñado para funcionar en Intranets locales sin acceso a internet, permitiendo el registro de visitantes y la recolección gamificada de piezas arqueológicas mediante códigos QR.

## Tecnologías Utilizadas
- **Frontend:** HTML5, CSS3, Tailwind CSS, JavaScript Vanilla, Chart.js.
- **Backend:** Node.js, Express.js.
- **Base de Datos:** MySQL (XAMPP/phpMyAdmin) con restricciones de integridad y consultas preparadas.
- **Seguridad:** Encriptación Bcrypt, sanitización de entradas, prevención de inyección SQL.

## Infraestructura de Red Local
Desplegado sobre red Wi-Fi local privada mediante router residencial Cisco, permitiendo concurrencia simulable en entornos rurales.

## Instrucciones de Instalación Local
1. Clona este repositorio:
   ```bash
   git clone https://github.com/julifll/museo-3d-recuze.git
2. Importa el archivo SQL museo_recuze_db.sql en phpMyAdmin.

3. Ingresa a la carpeta server, copia el archivo .env.example a .env e instala dependencias:

cd server
npm install
npm start
