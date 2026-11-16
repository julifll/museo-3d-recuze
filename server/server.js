require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const os = require('os');
const db = require('./db');
const { normalizarCodigo, correoEscrito, validarRegistro, validarLogin, validarDescubrimiento } = require('./validaciones');
const { sugerirApodos } = require('./apodos');
const { crearLimitador } = require('./limiteIntentos');
const { crearRouterAdmin, soloEstePC } = require('./admin');

const app = express();

app.use(express.json());

// Express entrega las páginas y el contenido (fotos y videos)
app.use('/quiosco', express.static(path.join(__dirname, '..', 'appquiosco')));
app.use('/galeria', express.static(path.join(__dirname, '..', 'galeria-web')));
app.use('/contenido', express.static(path.join(__dirname, '..', 'contenido')));

// Límite de intentos del ingreso: 5 fallos seguidos con el mismo documento lo bloquean 5 minutos.
// Se cuenta por DOCUMENTO y no por IP, porque el quiosco es un solo equipo que usan todos los niños.
const limitadorLogin = crearLimitador(5, 5 * 60 * 1000);

// Administrador: página y API, solo desde este PC y con clave (ver admin.js)
app.use('/admin', soloEstePC, express.static(path.join(__dirname, '..', 'admin')));
app.use('/api/admin', soloEstePC, crearRouterAdmin({ db, limitadorLogin }));

// Todas las IPv4 de este computador en la red: sirve para saber qué IP escribir en los QR
function getLocalIPs() {
    return Object.values(os.networkInterfaces())
        .flat()
        .filter((iface) => iface.family === 'IPv4' && !iface.internal)
        .map((iface) => iface.address);
}

// Datos de una pieza que el navegador puede ver (nunca se envía el código QR)
function datosPieza(p) {
    return {
        pieza: p.nombre_pieza,
        historia: p.resena_historica,
        periodo: p.periodo,
        material: p.material_original,
        procedencia: p.procedencia,
        dimensiones: p.dimensiones,
        fuente: p.fuente,
        video: p.ruta_video ? '/contenido/' + p.ruta_video : null
    };
}

/** 1. Endpoint: tres apodos libres para elegir en el registro */
app.get('/api/apodos', async (req, res) => {
    try {
        const [filas] = await db.query('SELECT apodo FROM visitante');
        const ocupados = new Set(filas.map((f) => f.apodo));
        const opciones = sugerirApodos(ocupados, 3);
        if (opciones.length === 0) {
            return res.status(503).json({ ok: false, mensaje: 'No quedan apodos libres. Avisa a un guía.' });
        }
        res.status(200).json({ ok: true, opciones });
    } catch (error) {
        console.error('Error al sugerir apodos:', error);
        res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
    }
});

/** 2. Endpoint: Registro de Visitantes (Quiosco) */
app.post('/api/visitantes', async (req, res) => {
    try {
        // El servidor revisa los datos ANTES de tocar la base de datos
        const datos = req.body ?? {};
        const errores = validarRegistro(datos);
        if (Object.keys(errores).length > 0) {
            return res.status(400).json({ ok: false, mensaje: 'Revisa los datos del formulario.', errores });
        }

        // Hash de la contraseña con bcrypt
        const password_hash = await bcrypt.hash(datos.contrasena, 10);

        // Correo opcional: si no lo escribieron se guarda NULL (NO texto vacío: dos '' chocarían en el UNIQUE)
        const correo = correoEscrito(datos.correo) ? datos.correo.trim() : null;

        const sql = 'INSERT INTO visitante (nombre, apellido, apodo, lugar_residencia, edad, numero_identificacion, correo, password_hash, grado, autoriza_datos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        const valores = [
            datos.nombre.trim(),
            datos.apellido.trim(),
            datos.apodo,
            datos.lugar_residencia.trim(),
            datos.edad,
            datos.numero_identificacion,
            correo,
            password_hash,
            datos.grado,
            true
        ];

        await db.query(sql, valores);

        res.status(201).json({ ok: true, mensaje: 'Visitante registrado con éxito', apodo: datos.apodo });

    } catch (error) {
        console.error('Error al registrar:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            // Dos niños pudieron elegir el mismo apodo casi al mismo tiempo: gana el primero
            if (String(error.sqlMessage || '').includes('uq_visitante_apodo')) {
                return res.status(409).json({
                    ok: false,
                    mensaje: 'Ese apodo se acaba de ocupar. Elige otro.',
                    errores: { apodo: 'Ese apodo se acaba de ocupar. Elige otro.' }
                });
            }
            res.status(409).json({ ok: false, mensaje: 'El documento o el correo ya está registrado.' });
        } else {
            res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
        }
    }
});

/** 3. Endpoint: Ingreso a "Mi recorrido" (documento + contraseña) */
app.post('/api/login', async (req, res) => {
    try {
        const datos = req.body ?? {};
        const errores = validarLogin(datos);
        if (Object.keys(errores).length > 0) {
            return res.status(400).json({ ok: false, mensaje: Object.values(errores)[0], errores });
        }
        const documento = datos.numero_identificacion;

        if (limitadorLogin.estaBloqueado(documento)) {
            return res.status(429).json({ ok: false, mensaje: 'Demasiados intentos. Espera unos minutos.' });
        }

        const [filas] = await db.query(
            'SELECT id_visitante, apodo, grado, password_hash FROM visitante WHERE numero_identificacion = ?',
            [documento]
        );

        // Un solo mensaje para "documento inexistente" y "contraseña mala": no revelamos qué documentos existen
        const coincide = filas.length > 0 && await bcrypt.compare(datos.contrasena, filas[0].password_hash);
        if (!coincide) {
            limitadorLogin.registrarFallo(documento);
            return res.status(401).json({ ok: false, mensaje: 'Documento o contraseña incorrectos.' });
        }
        limitadorLogin.limpiar(documento);

        const { id_visitante, apodo, grado } = filas[0];

        // Puntos totales
        const [[fila]] = await db.query(
            'SELECT COALESCE(SUM(puntos_obtenidos), 0) AS total FROM registrogamificacion WHERE id_visitante = ?',
            [id_visitante]
        );
        const total = Number(fila.total);

        // Posición dentro de su grado (solo si ya tiene puntos)
        let posicion = null;
        if (total > 0) {
            const [[pos]] = await db.query(
                `SELECT COUNT(*) + 1 AS posicion FROM (
                    SELECT r.id_visitante
                    FROM registrogamificacion r
                    JOIN visitante v ON v.id_visitante = r.id_visitante
                    WHERE v.grado = ?
                    GROUP BY r.id_visitante
                    HAVING SUM(r.puntos_obtenidos) > ?
                 ) mejores`,
                [grado, total]
            );
            posicion = Number(pos.posicion);
        }

        // Piezas que ya descubrió (con su ficha, para releerla sin volver a escanear)
        const [descubiertas] = await db.query(
            `SELECT p.*, r.puntos_obtenidos
             FROM registrogamificacion r
             JOIN pieza3d p ON p.id_pieza = r.id_pieza
             WHERE r.id_visitante = ?
             ORDER BY p.nombre_pieza`,
            [id_visitante]
        );

        // Cuántas piezas hay en total y cuántas suman puntos hoy
        const [[conteo]] = await db.query(
            'SELECT COUNT(*) AS total, COALESCE(SUM(suma_puntos), 0) AS con_puntos FROM pieza3d WHERE activa = 1'
        );

        res.status(200).json({
            ok: true,
            visitante: { apodo, grado },
            total_puntos: total,
            posicion,
            total_piezas: Number(conteo.total),
            piezas_con_puntos_hoy: Number(conteo.con_puntos),
            descubiertas: descubiertas.map((p) => ({
                ...datosPieza(p),
                slug: p.slug,
                puntos: p.puntos_obtenidos
            }))
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
    }
});

/** 4. Endpoint: Bóveda Zenú (solo documento + código; sin contraseña) */
app.post('/api/descubrimientos', async (req, res) => {
    try {
        const datos = req.body ?? {};
        const errores = validarDescubrimiento(datos);
        if (Object.keys(errores).length > 0) {
            return res.status(400).json({ ok: false, mensaje: Object.values(errores)[0], errores });
        }
        const { numero_identificacion, metodo } = datos;
        const codigo = normalizarCodigo(datos.codigo);

        const [piezas] = await db.query('SELECT * FROM pieza3d WHERE codigo_qr = ?', [codigo]);
        if (piezas.length === 0) {
            return res.status(404).json({ ok: false, mensaje: 'Código de pieza no encontrado.' });
        }
        const piezaEncontrada = piezas[0];

        // Pieza que hoy NO suma puntos: solo se muestra su información
        if (!piezaEncontrada.suma_puntos) {
            return res.status(200).json({ ok: true, suma_puntos: false, ...datosPieza(piezaEncontrada) });
        }

        const [visitantes] = await db.query('SELECT id_visitante FROM visitante WHERE numero_identificacion = ?', [numero_identificacion]);
        if (visitantes.length === 0) {
            return res.status(404).json({ ok: false, mensaje: 'Documento no registrado. Debes registrarte en el quiosco primero.' });
        }
        const visitanteEncontrado = visitantes[0];

        await db.query(
            'INSERT INTO registrogamificacion (id_visitante, id_pieza, puntos_obtenidos, metodo) VALUES (?, ?, ?, ?)',
            [visitanteEncontrado.id_visitante, piezaEncontrada.id_pieza, piezaEncontrada.puntos, metodo]
        );

        const [totalPuntos] = await db.query(
            'SELECT SUM(puntos_obtenidos) AS total FROM registrogamificacion WHERE id_visitante = ?',
            [visitanteEncontrado.id_visitante]
        );

        res.status(201).json({
            ok: true,
            suma_puntos: true,
            puntos: piezaEncontrada.puntos,
            total_puntos: Number(totalPuntos[0].total),
            ...datosPieza(piezaEncontrada)
        });

    } catch (error) {
        console.error('Error en descubrimientos:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ ok: false, mensaje: 'Ya descubriste esta pieza. ¡Busca otra para seguir sumando!' });
        } else {
            res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
        }
    }
});

/** 5. Endpoint: Ranking por Grado (muestra solo el apodo) */
app.get('/api/ranking', async (req, res) => {
    try {
        const gradoFiltro = req.query.grado;

        let sql = `
            SELECT v.apodo, v.grado AS grado, SUM(r.puntos_obtenidos) AS total_puntos
            FROM registrogamificacion r
            JOIN visitante v ON r.id_visitante = v.id_visitante
        `;
        const parametros = [];

        if (gradoFiltro) {
            sql += ' WHERE v.grado = ? ';
            parametros.push(gradoFiltro);
        }

        sql += ' GROUP BY v.id_visitante ORDER BY total_puntos DESC LIMIT 10';

        const [filas] = await db.query(sql, parametros);

        // MySQL devuelve SUM como texto: se convierte a número antes de enviarlo
        const ranking = filas.map((f) => ({ ...f, total_puntos: Number(f.total_puntos) }));

        res.status(200).json({ ok: true, ranking });

    } catch (error) {
        console.error('Error en ranking:', error);
        res.status(500).json({ ok: false, mensaje: 'Error al cargar el ranking.' });
    }
});

// Inicio: escucha en todas las interfaces ('0.0.0.0') para aceptar conexiones de la red local
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    console.log(`Acceso local: http://localhost:${PORT}/galeria/`);
    getLocalIPs().forEach((ip) => console.log(`Acceso en la red: http://${ip}:${PORT}/galeria/`));
});