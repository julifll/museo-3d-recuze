/**
 * GENERADOR DE QR DE LAS PIEZAS
 *
 * Crea la hoja imprimible  qr/hoja-qr.html  (en la carpeta principal del proyecto)
 * con un QR por pieza activa, su nombre y, DEBAJO, el código para escribirlo a mano
 * si el QR no se puede escanear.
 *
 * El QR contiene la dirección completa, con la IP del computador del museo:
 *     http://IP:PUERTO/galeria/?pieza=AVE-47#boveda-zenu
 * Por eso HAY QUE GENERARLOS CON LA IP DEFINITIVA (la del colegio). Si la IP cambia,
 * se vuelven a generar e imprimir.
 *
 * Uso (desde la carpeta "server"):
 *     node scripts/generar_qr.js 192.168.0.200
 * Sin IP, usa la del computador si solo tiene una; si tiene varias, las lista.
 *
 * Requiere el paquete "qrcode":  npm install qrcode   (con internet, una sola vez)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ¿Es una dirección IPv4 como 192.168.0.200 (cuatro números de 0 a 255)?
function esIPv4(texto) {
  const partes = String(texto).split('.');
  return partes.length === 4 && partes.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function ipsDeEstePC() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

// Decide qué IP usar. Devuelve { ip } o { error }
function elegirIP(argumento, ipsLocales) {
  if (argumento) {
    return esIPv4(argumento)
      ? { ip: argumento }
      : { error: `"${argumento}" no es una IP válida. Debe verse así: 192.168.0.200` };
  }
  if (ipsLocales.length === 1) return { ip: ipsLocales[0] };
  if (ipsLocales.length === 0) return { error: 'Este computador no está conectado a ninguna red. Escribe la IP: node scripts/generar_qr.js 192.168.0.200' };
  return { error: `Este computador tiene varias IP (${ipsLocales.join(', ')}). Escribe cuál usar: node scripts/generar_qr.js ${ipsLocales[0]}` };
}

function urlDePieza(ip, puerto, codigo) {
  return `http://${ip}:${puerto}/galeria/?pieza=${encodeURIComponent(codigo)}#boveda-zenu`;
}

// Arma la hoja imprimible. tarjetas = [{ nombre, codigo, url, svg }]
function crearHoja({ tarjetas, ip, puerto, fecha }) {
  const cuerpo = tarjetas.map((t) => `
      <article class="tarjeta">
        <h2>${escaparHTML(t.nombre)}</h2>
        <div class="qr">${t.svg}</div>
        <p class="codigo">${escaparHTML(t.codigo)}</p>
        <p class="url">${escaparHTML(t.url)}</p>
      </article>`).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QR de las piezas - Museo 3D ReCuZe</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #222; }
  .aviso { padding: 12px 16px; margin: 0 0 12px; background: #fff7d6; border: 1px solid #e0c200; border-radius: 8px; font-size: 14px; line-height: 1.5; }
  .hoja { display: grid; grid-template-columns: repeat(2, 1fr); }
  .tarjeta { height: 68mm; padding: 4mm; border: 1px dashed #888; display: flex; flex-direction: column; align-items: center; justify-content: space-between; break-inside: avoid; }
  .tarjeta h2 { margin: 0; font-size: 11pt; text-align: center; line-height: 1.2; }
  .qr { width: 38mm; height: 38mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .codigo { margin: 0; font: bold 20pt "Courier New", monospace; letter-spacing: 1px; }
  .url { margin: 0; font-size: 6pt; color: #555; word-break: break-all; text-align: center; }
  @media print { .aviso { display: none; } }
</style>
</head>
<body>
  <p class="aviso">
    <strong>Estos QR llevan la IP ${escaparHTML(ip)} (puerto ${escaparHTML(puerto)}).</strong>
    Solo funcionan con el computador del museo encendido y en la red del router del museo.
    Si la IP cambia, hay que generarlos de nuevo.
    Para imprimir: Ctrl + P, tamaño real (100 %), sin encabezados. Generado el ${escaparHTML(fecha)}.
  </p>
  <main class="hoja">
${cuerpo}
  </main>
</body>
</html>
`;
}

async function principal() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

  let QRCode;
  try {
    QRCode = require('qrcode');
  } catch {
    console.error('Falta el paquete "qrcode". Con internet, en la carpeta server ejecuta:  npm install qrcode');
    process.exit(1);
  }

  const eleccion = elegirIP(process.argv[2], ipsDeEstePC());
  if (eleccion.error) {
    console.error(eleccion.error);
    process.exit(1);
  }
  const puerto = process.env.PORT || 3000;

  const db = require('../db');
  try {
    const [piezas] = await db.query('SELECT nombre_pieza, codigo_qr FROM pieza3d WHERE activa = 1 ORDER BY nombre_pieza');
    if (piezas.length === 0) {
      console.error('No hay piezas activas en la base de datos.');
      process.exit(1);
    }

    const tarjetas = await Promise.all(piezas.map(async (p) => {
      const url = urlDePieza(eleccion.ip, puerto, p.codigo_qr);
      // Corrección de errores "M": el QR se sigue leyendo aunque se ensucie o se doble un poco
      const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
      return { nombre: p.nombre_pieza, codigo: p.codigo_qr, url, svg };
    }));

    const carpeta = path.join(__dirname, '..', '..', 'qr');
    fs.mkdirSync(carpeta, { recursive: true });
    const archivo = path.join(carpeta, 'hoja-qr.html');
    fs.writeFileSync(archivo, crearHoja({ tarjetas, ip: eleccion.ip, puerto, fecha: new Date().toLocaleString('es-CO') }), 'utf8');

    console.log(`Listo: ${tarjetas.length} QR con la IP ${eleccion.ip}:${puerto}`);
    tarjetas.forEach((t) => console.log(`  ${t.codigo.padEnd(8)} ${t.url}`));
    console.log(`\nAbre este archivo en el navegador e imprímelo:\n  ${archivo}`);
  } finally {
    await db.end(); // cierra la conexión para que el programa termine
  }
}

if (require.main === module) {
  principal().catch((error) => {
    console.error('No se pudieron generar los QR:', error.message);
    process.exit(1);
  });
}

module.exports = { escaparHTML, esIPv4, elegirIP, urlDePieza, crearHoja };
