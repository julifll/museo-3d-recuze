const express = require('express');
const os = require('os');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { crearLimitador } = require('./limiteIntentos');
const { CLAVE_MIN, CLAVE_MAX } = require('./validaciones');

const limitadorAdmin = crearLimitador(5, 5 * 60 * 1000);

// Direcciones de este mismo computador (la de "localhost" y las de sus tarjetas de red)
function direccionesPropias() {
  const propias = new Set(['127.0.0.1', '::1']);
  Object.values(os.networkInterfaces()).flat().forEach((i) => propias.add(i.address));
  return propias;
}

// ¿La petición viene de este mismo PC? (se calcula en cada petición: la IP puede cambiar)
function esDesdeEstePC(req) {
  const origen = String(req.socket?.remoteAddress ?? '').replace(/^::ffff:/, '');
  return direccionesPropias().has(origen);
}

function soloEstePC(req, res, next) {
  if (esDesdeEstePC(req)) return next();
  res.status(403).json({ ok: false, mensaje: 'El administrador solo funciona desde el computador del museo.' });
}

// Se compara el resumen (hash) de ambas claves para que el tiempo de respuesta no delate cuántas letras acertó
function claveCorrecta(recibida, esperada) {
  const a = crypto.createHash('sha256').update(recibida).digest();
  const b = crypto.createHash('sha256').update(esperada).digest();
  return crypto.timingSafeEqual(a, b);
}

function exigirClave(req, res, next) {
  const esperada = process.env.ADMIN_CLAVE ?? '';
  if (esperada.length < 8) {
    return res.status(503).json({
      ok: false,
      mensaje: 'El administrador está desactivado. Define ADMIN_CLAVE (mínimo 8 caracteres) en el archivo .env y reinicia el servidor.'
    });
  }
  if (limitadorAdmin.estaBloqueado('admin')) {
    return res.status(429).json({ ok: false, mensaje: 'Demasiados intentos. Espera 5 minutos.' });
  }
  let recibida = '';
  try {
    recibida = decodeURIComponent(req.get('x-admin-clave') ?? ''); // el navegador la envía codificada (admite tildes)
  } catch { /* clave mal codificada: queda vacía y falla abajo */ }

  if (!claveCorrecta(recibida, esperada)) {
    limitadorAdmin.registrarFallo('admin');
    return res.status(401).json({ ok: false, mensaje: 'Clave de administrador incorrecta.' });
  }
  limitadorAdmin.limpiar('admin');
  next();
}

function idValido(texto) {
  const id = Number(texto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function crearRouterAdmin({ db, limitadorLogin }) {
  const router = express.Router();
  router.use(exigirClave);

  // Sirve para que la página compruebe la clave al entrar
  router.get('/estado', (req, res) => res.json({ ok: true }));

  /* ---------- Piezas ---------- */

  router.get('/piezas', async (req, res) => {
    const [piezas] = await db.query(
      'SELECT id_pieza, nombre_pieza, codigo_qr, puntos, suma_puntos, activa FROM pieza3d ORDER BY nombre_pieza'
    );
    res.json({
      ok: true,
      piezas: piezas.map((p) => ({ ...p, suma_puntos: Boolean(p.suma_puntos), activa: Boolean(p.activa) }))
    });
  });

  // Cambiar si una pieza suma puntos hoy y/o cuántos puntos da
  router.patch('/piezas/:id', async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ ok: false, mensaje: 'Pieza no válida.' });

    const { suma_puntos, puntos } = req.body ?? {};
    const cambios = [];
    const valores = [];
    if (suma_puntos !== undefined) {
      if (typeof suma_puntos !== 'boolean') return res.status(400).json({ ok: false, mensaje: 'suma_puntos debe ser verdadero o falso.' });
      cambios.push('suma_puntos = ?');
      valores.push(suma_puntos ? 1 : 0);
    }
    if (puntos !== undefined) {
      if (!Number.isInteger(puntos) || puntos < 0 || puntos > 1000) {
        return res.status(400).json({ ok: false, mensaje: 'Los puntos deben ser un número entero entre 0 y 1000.' });
      }
      cambios.push('puntos = ?');
      valores.push(puntos);
    }
    if (cambios.length === 0) return res.status(400).json({ ok: false, mensaje: 'No hay nada que cambiar.' });

    const [resultado] = await db.query(`UPDATE pieza3d SET ${cambios.join(', ')} WHERE id_pieza = ?`, [...valores, id]);
    if (resultado.affectedRows === 0) return res.status(404).json({ ok: false, mensaje: 'Esa pieza no existe.' });
    res.json({ ok: true });
  });

  /* ---------- Visitantes ---------- */

  // Buscar por documento, apodo, nombre o apellido (sin texto: los 50 más recientes)
  router.get('/visitantes', async (req, res) => {
    const texto = String(req.query.q ?? '').trim().slice(0, 50);
    const patron = `%${texto.replace(/[\\%_]/g, '\\$&')}%`;
    const filtro = texto
      ? 'WHERE v.numero_identificacion LIKE ? OR v.apodo LIKE ? OR v.nombre LIKE ? OR v.apellido LIKE ?'
      : '';
    const [filas] = await db.query(
      `SELECT v.id_visitante, v.nombre, v.apellido, v.apodo, v.grado, v.numero_identificacion,
              COALESCE(SUM(r.puntos_obtenidos), 0) AS total_puntos
       FROM visitante v
       LEFT JOIN registrogamificacion r ON r.id_visitante = v.id_visitante
       ${filtro}
       GROUP BY v.id_visitante
       ORDER BY v.id_visitante DESC
       LIMIT 50`,
      texto ? [patron, patron, patron, patron] : []
    );
    res.json({ ok: true, visitantes: filas.map((f) => ({ ...f, total_puntos: Number(f.total_puntos) })) });
  });

  // Contraseña nueva (el niño la olvidó). También le quita el bloqueo si lo tenía.
  router.post('/visitantes/:id/clave', async (req, res) => {
    const id = idValido(req.params.id);
    const clave = req.body?.contrasena;
    if (!id) return res.status(400).json({ ok: false, mensaje: 'Visitante no válido.' });
    if (typeof clave !== 'string' || clave.length < CLAVE_MIN || clave.length > CLAVE_MAX) {
      return res.status(400).json({ ok: false, mensaje: `La contraseña debe tener entre ${CLAVE_MIN} y ${CLAVE_MAX} caracteres.` });
    }
    const [filas] = await db.query('SELECT numero_identificacion FROM visitante WHERE id_visitante = ?', [id]);
    if (filas.length === 0) return res.status(404).json({ ok: false, mensaje: 'Ese visitante no existe.' });

    await db.query('UPDATE visitante SET password_hash = ? WHERE id_visitante = ?', [await bcrypt.hash(clave, 10), id]);
    limitadorLogin.limpiar(filas[0].numero_identificacion);
    res.json({ ok: true });
  });

  // Quitar el bloqueo por intentos fallidos sin cambiar la contraseña
  router.post('/visitantes/:id/desbloquear', async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ ok: false, mensaje: 'Visitante no válido.' });
    const [filas] = await db.query('SELECT numero_identificacion FROM visitante WHERE id_visitante = ?', [id]);
    if (filas.length === 0) return res.status(404).json({ ok: false, mensaje: 'Ese visitante no existe.' });
    limitadorLogin.limpiar(filas[0].numero_identificacion);
    res.json({ ok: true });
  });

  // Borra los descubrimientos de UN visitante (queda registrado, con 0 puntos)
  router.post('/visitantes/:id/reiniciar-puntos', async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ ok: false, mensaje: 'Visitante no válido.' });
    await db.query('DELETE FROM registrogamificacion WHERE id_visitante = ?', [id]);
    res.json({ ok: true });
  });

  // Borra a UN visitante; por ON DELETE CASCADE se van también sus descubrimientos
  router.delete('/visitantes/:id', async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ ok: false, mensaje: 'Visitante no válido.' });
    const [resultado] = await db.query('DELETE FROM visitante WHERE id_visitante = ?', [id]);
    if (resultado.affectedRows === 0) return res.status(404).json({ ok: false, mensaje: 'Ese visitante no existe.' });
    res.json({ ok: true });
  });

  /* ---------- Cierre del evento (acciones masivas) ---------- */
  // Piden escribir una palabra de confirmación: no se pueden lanzar por un clic accidental.

  router.post('/cierre/reiniciar-puntos', async (req, res) => {
    if (req.body?.confirmacion !== 'REINICIAR') return res.status(400).json({ ok: false, mensaje: 'Falta la confirmación.' });
    const [[antes]] = await db.query('SELECT COUNT(*) AS n FROM registrogamificacion');
    await db.query('DELETE FROM registrogamificacion');
    res.json({ ok: true, borrados: Number(antes.n) });
  });

  router.post('/cierre/borrar-visitantes', async (req, res) => {
    if (req.body?.confirmacion !== 'BORRAR') return res.status(400).json({ ok: false, mensaje: 'Falta la confirmación.' });
    const [[antes]] = await db.query('SELECT COUNT(*) AS n FROM visitante');
    await db.query('DELETE FROM visitante');
    res.json({ ok: true, borrados: Number(antes.n) });
  });

  // Cualquier error inesperado (por ejemplo, la base de datos caída) responde JSON, no una página de error
  router.use((error, req, res, next) => {
    console.error('Error en el administrador:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
  });

  return router;
}

module.exports = { crearRouterAdmin, soloEstePC, esDesdeEstePC };