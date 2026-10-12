const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const db = require('./db');
const app = express();
app.use(cors());
app.use(express.json());



app.post('/api/visitantes', async (req, res) => {
    try {
        
        const { nombre, apellido, lugar_residencia, edad, numero_identificacion, correo, contrasena, grado, autoriza_datos } = req.body;

        const password_hash = await bcrypt.hash(contrasena, 10);

        const sql = 'INSERT INTO Visitante (nombre, apellido, lugar_residencia, edad, numero_identificacion, correo, password_hash, grado, autoriza_datos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        
        const valores = [nombre, apellido, lugar_residencia, edad, numero_identificacion, correo, password_hash, grado, autoriza_datos];

        // Se ejecuta la inserción en la base de datos
        await db.query(sql, valores);

        res.status(201).json({ ok: true, mensaje: "Visitante registrado con éxito" });

    } catch (error) {
        console.error("Error al registrar:", error);
        
        // Error específico para entradas duplicadas
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ ok: false, mensaje: "El documento o correo ya está registrado." });
        } else {
            res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
        }
    }
});


app.post('/api/login', async (req, res) => {
    try {
        const { correo, contrasena } = req.body;
        const sqlBusqueda = 'SELECT * FROM Visitante WHERE correo = ?';
        const [filas] = await db.query(sqlBusqueda, [correo]);

        if (filas.length === 0) {
            return res.status(404).json({ ok: false, mensaje: "Correo no encontrado." });
        }

        const visitanteEncontrado = filas[0];

        const coincide = await bcrypt.compare(contrasena, visitanteEncontrado.password_hash);

        if (!coincide) {
            return res.status(401).json({ ok: false, mensaje: "Contraseña incorrecta." }); // Error 401
        }

        res.status(200).json({ 
            ok: true, 
            visitante: { 
                nombre: visitanteEncontrado.nombre, 
                apellido: visitanteEncontrado.apellido 
            } 
        });

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
    }
});

/** Endpoint Bóveda Zenú */
app.post('/api/descubrimientos', async (req, res) => {
    try {
        const { numero_identificacion, codigo, metodo } = req.body;
        const [piezas] = await db.query('SELECT * FROM Pieza3D WHERE codigo_qr = ?', [codigo]);
        if (piezas.length === 0) {
            return res.status(404).json({ ok: false, mensaje: "Código de pieza no encontrado." });
        }
        const piezaEncontrada = piezas[0];

        const [visitantes] = await db.query('SELECT id_visitante FROM Visitante WHERE numero_identificacion = ?', [numero_identificacion]);
        if (visitantes.length === 0) {
            return res.status(404).json({ ok: false, mensaje: "Documento no registrado. Debes registrarte en el quiosco primero." });
        }
        const visitanteEncontrado = visitantes[0];

        const sqlInsert = 'INSERT INTO RegistroGamificacion (id_visitante, id_pieza, puntos_obtenidos, metodo) VALUES (?, ?, ?, ?)';
        const valores = [visitanteEncontrado.id_visitante, piezaEncontrada.id_pieza, piezaEncontrada.puntos, metodo];

        await db.query(sqlInsert, valores);

        const [totalPuntos] = await db.query(
            'SELECT SUM(puntos_obtenidos) as total FROM RegistroGamificacion WHERE id_visitante = ?', 
            [visitanteEncontrado.id_visitante]
        );

        res.status(201).json({ 
            ok: true, 
            pieza: piezaEncontrada.nombre_pieza,
            puntos: piezaEncontrada.puntos,
            total_puntos: totalPuntos[0].total,
            imagen: piezaEncontrada.ruta_imagen,
            historia: piezaEncontrada.resena_historica
        });

    } catch (error) {
        console.error("Error en descubrimientos:", error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ ok: false, mensaje: "¡Ya descubriste esta pieza antes!" });
        } else {
            res.status(500).json({ ok: false, mensaje: "Error interno del servidor." });
        }
    }
});


/** Endpoint Ranking por Grado  */
app.get('/api/ranking', async (req, res) => {
    try {
        const gradoFiltro = req.query.grado; 

        let sql = `
            SELECT v.nombre, v.grado as grado, SUM(r.puntos_obtenidos) AS total_puntos 
            FROM RegistroGamificacion r 
            JOIN Visitante v ON r.id_visitante = v.id_visitante 
        `;
        let parametros = [];

        if (gradoFiltro) {
            sql += ' WHERE v.grado = ? ';
            parametros.push(gradoFiltro);
        }

        sql += ' GROUP BY v.id_visitante ORDER BY total_puntos DESC LIMIT 10';

        const [ranking] = await db.query(sql, parametros);

        res.status(200).json({ ok: true, ranking: ranking });

    } catch (error) {
        console.error("Error en ranking:", error);
        res.status(500).json({ ok: false, mensaje: "Error al cargar el ranking." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

