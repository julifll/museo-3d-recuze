document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  let clave = null;

  function crear(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }

  function avisar(texto, mal = false) {
    const aviso = $('aviso');
    aviso.textContent = texto;
    aviso.classList.toggle('mal', mal);
  }

  /* ---------- Comunicación con el servidor ---------- */

  async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
    try {
      const encabezados = { 'X-Admin-Clave': encodeURIComponent(clave ?? '') };
      if (cuerpo) encabezados['Content-Type'] = 'application/json';
      const resp = await fetch('/api/admin' + ruta, {
        method: metodo,
        headers: encabezados,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
      });
      const datos = await resp.json().catch(() => ({}));
      return { estado: resp.status, datos };
    } catch {
      return { estado: 0, datos: { mensaje: 'No hay conexión con el servidor del museo.' } };
    }
  }

  // Hace una acción y muestra el error si falla. Devuelve los datos si salió bien, o null.
  async function ejecutar(ruta, opciones) {
    const { estado, datos } = await api(ruta, opciones);
    if (estado === 401 || estado === 503) {
      salir(datos.mensaje || 'La clave ya no es válida. Entra de nuevo.');
      return null;
    }
    if (estado >= 200 && estado < 300 && datos.ok) return datos;
    avisar(datos.mensaje || `No se pudo completar (código ${estado}).`, true);
    return null;
  }

  /* ---------- Entrar y salir ---------- */

  function salir(mensaje = '') {
    clave = null;
    $('panel').hidden = true;
    $('seccion-entrada').hidden = false;
    $('tabla-piezas').replaceChildren();
    $('tabla-visitantes').replaceChildren();
    $('error-entrada').textContent = mensaje;
    avisar('');
    $('clave-admin').focus();
  }

  $('form-entrada').addEventListener('submit', async (e) => {
    e.preventDefault();
    clave = $('clave-admin').value;
    const { estado, datos } = await api('/estado');
    if (estado === 200 && datos.ok) {
      $('clave-admin').value = '';
      $('error-entrada').textContent = '';
      $('seccion-entrada').hidden = true;
      $('panel').hidden = false;
      await Promise.all([cargarPiezas(), buscarVisitantes('')]);
      return;
    }
    clave = null;
    $('error-entrada').textContent = datos.mensaje || `No se pudo entrar (código ${estado}).`;
  });
  $('btn-salir').addEventListener('click', () => salir('Saliste del administrador.'));

  /* ---------- Ventana de preguntas ---------- */

  const dialogo = $('dialogo');
  $('dialogo-cancelar').addEventListener('click', () => dialogo.close('cancelar'));

  // Devuelve: null si cancelan; el texto escrito si hay campo; true si es solo una confirmación
  function preguntar({ titulo, mensaje, etiqueta, tipo = 'text', validar, botonOk = 'Aceptar' }) {
    return new Promise((resolver) => {
      const campo = $('dialogo-campo');
      const rotulo = $('dialogo-etiqueta');
      $('dialogo-titulo').textContent = titulo;
      $('dialogo-mensaje').textContent = mensaje;
      $('dialogo-error').textContent = '';
      $('dialogo-ok').textContent = botonOk;
      campo.hidden = rotulo.hidden = !etiqueta;
      if (etiqueta) {
        rotulo.textContent = etiqueta;
        campo.type = tipo;
        campo.value = '';
      }

      const formulario = $('dialogo-form');
      function alEnviar(e) {
        if (!etiqueta || !validar) return;
        const problema = validar(campo.value);
        if (problema) {
          e.preventDefault(); // la ventana no se cierra hasta que el dato sea correcto
          $('dialogo-error').textContent = problema;
          campo.focus();
        }
      }
      function alCerrar() {
        formulario.removeEventListener('submit', alEnviar);
        dialogo.removeEventListener('close', alCerrar);
        resolver(dialogo.returnValue === 'ok' ? (etiqueta ? campo.value : true) : null);
      }
      formulario.addEventListener('submit', alEnviar);
      dialogo.addEventListener('close', alCerrar);

      dialogo.returnValue = ''; // si cierran con Esc no debe quedar el "ok" de la vez anterior
      dialogo.showModal();
      (etiqueta ? campo : $('dialogo-ok')).focus();
    });
  }

  /* ---------- Piezas ---------- */

  function crearFilaPieza(p) {
    const fila = crear('tr', p.suma_puntos ? '' : 'sin-puntos-hoy');

    const casilla = document.createElement('input');
    casilla.type = 'checkbox';
    casilla.checked = p.suma_puntos;
    casilla.setAttribute('aria-label', `${p.nombre_pieza}: suma puntos hoy`);

    const puntos = document.createElement('input');
    puntos.type = 'number';
    puntos.min = '0';
    puntos.max = '1000';
    puntos.value = String(p.puntos);
    puntos.setAttribute('aria-label', `${p.nombre_pieza}: puntos`);

    const boton = crear('button', 'boton chico', 'Guardar');
    boton.type = 'button';
    boton.addEventListener('click', async () => {
      const valor = Number(puntos.value);
      if (puntos.value === '' || !Number.isInteger(valor) || valor < 0 || valor > 1000) {
        avisar('Los puntos deben ser un número entero entre 0 y 1000.', true);
        puntos.focus();
        return;
      }
      boton.disabled = true;
      const datos = await ejecutar(`/piezas/${p.id_pieza}`, { metodo: 'PATCH', cuerpo: { suma_puntos: casilla.checked, puntos: valor } });
      boton.disabled = false;
      if (!datos) return;
      fila.classList.toggle('sin-puntos-hoy', !casilla.checked);
      avisar(casilla.checked
        ? `Guardado: "${p.nombre_pieza}" suma ${valor} puntos hoy.`
        : `Guardado: "${p.nombre_pieza}" hoy no suma puntos.`);
    });

    const celda = (...hijos) => { const td = crear('td'); td.append(...hijos); return td; };
    fila.append(
      crear('td', '', p.nombre_pieza),
      crear('td', '', p.codigo_qr),
      celda(casilla),
      celda(puntos),
      celda(boton)
    );
    return fila;
  }

  async function cargarPiezas() {
    const datos = await ejecutar('/piezas');
    if (!datos) return;
    $('tabla-piezas').replaceChildren(...datos.piezas.map(crearFilaPieza));
  }

  /* ---------- Visitantes ---------- */

  function crearBoton(texto, alHacerClic, clase = '') {
    const boton = crear('button', `boton chico ${clase}`.trim(), texto);
    boton.type = 'button';
    boton.addEventListener('click', alHacerClic);
    return boton;
  }

  function crearFilaVisitante(v) {
    const fila = crear('tr');
    const acciones = crear('td', 'acciones');

    acciones.append(
      crearBoton('Nueva contraseña', async () => {
        const nueva = await preguntar({
          titulo: `Nueva contraseña para ${v.apodo}`,
          mensaje: 'Entre 4 y 8 caracteres. Anótala y entrégasela al niño. También se quita el bloqueo si lo tenía.',
          etiqueta: 'Contraseña nueva',
          validar: (texto) => (texto.length >= 4 && texto.length <= 8 ? null : 'Debe tener entre 4 y 8 caracteres.')
        });
        if (nueva === null) return;
        if (await ejecutar(`/visitantes/${v.id_visitante}/clave`, { metodo: 'POST', cuerpo: { contrasena: nueva } })) {
          avisar(`Listo: ${v.apodo} ya tiene contraseña nueva.`);
        }
      }, 'secundario'),

      crearBoton('Desbloquear', async () => {
        if (await ejecutar(`/visitantes/${v.id_visitante}/desbloquear`, { metodo: 'POST' })) {
          avisar(`Listo: ${v.apodo} puede volver a intentar.`);
        }
      }, 'secundario'),

      crearBoton('Reiniciar puntos', async () => {
        const seguro = await preguntar({
          titulo: 'Reiniciar puntos',
          mensaje: `Se borran los descubrimientos de ${v.apodo} (${v.total_puntos} puntos). Seguirá registrado.`,
          botonOk: 'Reiniciar'
        });
        if (!seguro) return;
        if (await ejecutar(`/visitantes/${v.id_visitante}/reiniciar-puntos`, { metodo: 'POST' })) {
          avisar(`Listo: ${v.apodo} quedó en 0 puntos.`);
          await buscarVisitantes($('buscar').value);
        }
      }, 'secundario'),

      crearBoton('Borrar', async () => {
        const seguro = await preguntar({
          titulo: 'Borrar visitante',
          mensaje: `Se borra a ${v.apodo} (documento ${v.numero_identificacion}) con todos sus puntos. No se puede deshacer.`,
          botonOk: 'Borrar'
        });
        if (!seguro) return;
        if (await ejecutar(`/visitantes/${v.id_visitante}`, { metodo: 'DELETE' })) {
          avisar(`Listo: ${v.apodo} fue borrado.`);
          await buscarVisitantes($('buscar').value);
        }
      }, 'peligro')
    );

    fila.append(
      crear('td', '', v.apodo),
      crear('td', '', `${v.nombre} ${v.apellido}`),
      crear('td', '', v.numero_identificacion),
      crear('td', '', v.grado),
      crear('td', '', String(v.total_puntos)),
      acciones
    );
    return fila;
  }

  async function buscarVisitantes(texto) {
    const datos = await ejecutar('/visitantes?q=' + encodeURIComponent(String(texto).trim()));
    if (!datos) return;
    const cuerpo = $('tabla-visitantes');
    if (datos.visitantes.length === 0) {
      const celda = crear('td', 'vacio', 'No hay visitantes con ese dato.');
      celda.colSpan = 6;
      const fila = crear('tr');
      fila.append(celda);
      cuerpo.replaceChildren(fila);
    } else {
      cuerpo.replaceChildren(...datos.visitantes.map(crearFilaVisitante));
    }
    $('resumen-visitantes').textContent = datos.visitantes.length === 50
      ? 'Mostrando 50 visitantes. Escribe algo en la búsqueda para afinar.'
      : `${datos.visitantes.length} visitante(s).`;
  }

  $('form-buscar').addEventListener('submit', (e) => {
    e.preventDefault();
    buscarVisitantes($('buscar').value);
  });

  /* ---------- Cierre del evento ---------- */

  async function accionMasiva({ titulo, mensaje, palabra, ruta, textoListo }) {
    const escrito = await preguntar({
      titulo,
      mensaje,
      etiqueta: `Escribe ${palabra} para confirmar`,
      validar: (texto) => (texto.trim() === palabra ? null : `Escribe la palabra exacta: ${palabra}.`),
      botonOk: 'Confirmar'
    });
    if (escrito === null) return;
    const datos = await ejecutar(ruta, { metodo: 'POST', cuerpo: { confirmacion: palabra } });
    if (!datos) return;
    avisar(textoListo(datos.borrados));
    await buscarVisitantes($('buscar').value);
  }

  $('btn-reiniciar-todos').addEventListener('click', () => accionMasiva({
    titulo: 'Reiniciar los puntos de todos',
    mensaje: 'Se borran los descubrimientos de TODOS los visitantes. Los registros se conservan.',
    palabra: 'REINICIAR',
    ruta: '/cierre/reiniciar-puntos',
    textoListo: (n) => `Listo: se borraron ${n} descubrimientos.`
  }));

  $('btn-borrar-todos').addEventListener('click', () => accionMasiva({
    titulo: 'Borrar a todos los visitantes',
    mensaje: 'Se borran TODOS los visitantes y sus puntos. Las piezas no se tocan. No se puede deshacer.',
    palabra: 'BORRAR',
    ruta: '/cierre/borrar-visitantes',
    textoListo: (n) => `Listo: se borraron ${n} visitantes.`
  }));
});