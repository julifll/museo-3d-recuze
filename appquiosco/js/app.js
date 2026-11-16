document.addEventListener('DOMContentLoaded', () => {
  const INACTIVIDAD_MS = 90 * 1000;
  const EXPRESION_DOCUMENTO = /^\d{6,20}$/;
  const EXPRESION_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const INICIO = 'pantalla-bienvenida';

  const $ = (id) => document.getElementById(id);
  const pantallas = [...document.querySelectorAll('.screen')];
  let pantallaActual = INICIO;
  let temporizador = null;

  // Crea un elemento con clase y texto (el texto se pone como texto, no como HTML)
  function crear(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }

  /* ---------- Navegación e inactividad ---------- */

  function detenerVideos() {
    document.querySelectorAll('video').forEach((v) => v.pause());
  }

  function programarInactividad() {
    clearTimeout(temporizador);
    if (pantallaActual !== INICIO) temporizador = setTimeout(volverAlInicio, INACTIVIDAD_MS);
  }

  function mostrarPantalla(id) {
    pantallaActual = id;
    pantallas.forEach((p) => { p.hidden = p.id !== id; });
    detenerVideos();
    window.scrollTo(0, 0);
    // El título recibe el foco para que lectores de pantalla y teclado sepan dónde están
    $(id).querySelector('[tabindex="-1"]')?.focus({ preventScroll: true });
    programarInactividad();
  }

  function limpiarErrores(formulario) {
    formulario.querySelectorAll('.field-error').forEach((e) => { e.textContent = ''; });
    formulario.querySelectorAll('.invalid').forEach((e) => e.classList.remove('invalid'));
  }

  // Deja los formularios y los datos como si nadie hubiera pasado por el quiosco
  function volverAlInicio() {
    ['registro-visitantes-form', 'inicio-sesion-form'].forEach((id) => {
      const formulario = $(id);
      formulario.reset();
      limpiarErrores(formulario);
    });
    document.querySelectorAll('[data-mostrar]').forEach((casilla) => { $(casilla.dataset.mostrar).type = 'password'; });
    $('apodos-opciones').replaceChildren();
    $('recorrido-lista').replaceChildren();
    mostrarPantalla(INICIO);
  }

  ['pointerdown', 'keydown', 'input', 'scroll'].forEach((evento) => {
    window.addEventListener(evento, programarInactividad, { passive: true });
  });

  // Si la página vuelve desde la memoria del navegador (botón "atrás"), no debe mostrar datos de otro niño
  window.addEventListener('pageshow', (e) => { if (e.persisted) volverAlInicio(); });

  /* ---------- Servidor ---------- */

  // Rutas relativas: funcionan desde cualquier IP de la red local
  async function pedir(url, cuerpo) {
    try {
      const opciones = cuerpo === undefined ? undefined : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
      };
      const resp = await fetch(url, opciones);
      const datos = await resp.json().catch(() => ({}));
      return { estado: resp.status, datos };
    } catch {
      return { estado: 0, datos: { mensaje: 'No hay conexión con el servidor del museo. Avisa a un guía.' } };
    }
  }

  function ponerError(campo, mensaje) {
    const entrada = document.querySelector(`[name="${campo}"]`);
    if (entrada && entrada.type !== 'radio') entrada.classList.add('invalid');
    const aviso = $(`error-${campo}`);
    if (aviso) aviso.textContent = mensaje;
  }

  /* ---------- Botones de navegación ---------- */

  $('btn-iniciar-registro').addEventListener('click', () => {
    mostrarPantalla('pantalla-registro');
    cargarApodos();
  });
  $('btn-iniciar-sesion').addEventListener('click', () => mostrarPantalla('pantalla-inicio-sesion'));
  ['btn-cancelar', 'btn-cancelar-sesion', 'btn-volver-inicio', 'btn-cerrar-recorrido'].forEach((id) => {
    $(id).addEventListener('click', volverAlInicio);
  });

  // "Mostrar contraseña": un solo oyente para todas las casillas
  document.addEventListener('change', (e) => {
    const casilla = e.target.closest?.('[data-mostrar]');
    if (casilla) $(casilla.dataset.mostrar).type = casilla.checked ? 'text' : 'password';
  });

  /* ---------- Registro ---------- */

  function crearOpcionApodo(texto) {
    const etiqueta = crear('label', 'apodo-opcion');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'apodo';
    radio.value = texto;
    etiqueta.append(radio, crear('span', '', texto));
    return etiqueta;
  }

  async function cargarApodos() {
    const boton = $('btn-otros-apodos');
    boton.disabled = true;
    $('error-apodo').textContent = '';
    const { estado, datos } = await pedir('/api/apodos');
    boton.disabled = false;
    if (estado !== 200 || !Array.isArray(datos.opciones)) {
      $('apodos-opciones').replaceChildren();
      $('error-apodo').textContent = datos.mensaje || 'No se pudieron cargar los apodos. Avisa a un guía.';
      return;
    }
    $('apodos-opciones').replaceChildren(...datos.opciones.map(crearOpcionApodo));
  }
  $('btn-otros-apodos').addEventListener('click', cargarApodos);

  // Revisión rápida para ayudar al niño; el servidor vuelve a revisar todo
  function revisarRegistro(r) {
    const errores = {};
    if (r.nombre.length < 2) errores.nombre = 'Escribe tu nombre.';
    if (r.apellido.length < 2) errores.apellido = 'Escribe tu apellido.';
    if (r.lugar_residencia.length < 3) errores.lugar_residencia = 'Indica dónde vives.';
    if (!Number.isInteger(r.edad) || r.edad < 1 || r.edad > 120) errores.edad = 'La edad debe ser un número.';
    if (!EXPRESION_DOCUMENTO.test(r.numero_identificacion)) errores.numero_identificacion = 'Escribe tu documento: solo números, entre 6 y 20.';
    if (r.correo && !EXPRESION_CORREO.test(r.correo)) errores.correo = 'Ese correo no es válido. Déjalo vacío si no tienes.';
    if (r.contrasena.length < 4 || r.contrasena.length > 8) errores.contrasena = 'La contraseña debe tener entre 4 y 8 caracteres.';
    if (!r.grado) errores.grado = 'Elige tu grado.';
    if (!r.apodo) errores.apodo = 'Elige uno de los apodos.';
    if (!r.autoriza_datos) errores.autoriza_datos = 'Debes autorizar el tratamiento de tus datos.';
    return errores;
  }

  const formularioRegistro = $('registro-visitantes-form');
  formularioRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formularioRegistro);

    const datos = new FormData(formularioRegistro);
    const texto = (nombre) => String(datos.get(nombre) ?? '').trim();
    const registro = {
      nombre: texto('nombre'),
      apellido: texto('apellido'),
      lugar_residencia: texto('lugar_residencia'),
      edad: Number(datos.get('edad')),
      numero_identificacion: texto('numero_identificacion'),
      correo: texto('correo'),
      contrasena: String(datos.get('contrasena') ?? ''), // sin recortar: igual que en el ingreso
      grado: texto('grado'),
      apodo: texto('apodo'),
      autoriza_datos: datos.get('autoriza_datos') === 'on'
    };

    const errores = revisarRegistro(registro);
    if (Object.keys(errores).length > 0) {
      Object.entries(errores).forEach(([campo, mensaje]) => ponerError(campo, mensaje));
      formularioRegistro.querySelector('.invalid')?.focus();
      return;
    }

    const boton = formularioRegistro.querySelector('[type="submit"]');
    boton.disabled = true;
    const { estado, datos: respuesta } = await pedir('/api/visitantes', registro);
    boton.disabled = false;

    if (estado === 201 && respuesta.ok) {
      $('exito-apodo').textContent = respuesta.apodo || registro.apodo;
      formularioRegistro.reset();
      $('apodos-opciones').replaceChildren();
      mostrarPantalla('pantalla-exito');
      return;
    }

    const erroresServidor = respuesta.errores ?? {};
    const { apodo, ...otros } = erroresServidor;
    Object.entries(otros).forEach(([campo, mensaje]) => ponerError(campo, mensaje));
    if (apodo) {
      // El apodo se ocupó o no era válido: se piden opciones nuevas
      await cargarApodos();
      ponerError('apodo', apodo);
    }
    if (Object.keys(erroresServidor).length === 0) {
      $('error-general-registro').textContent = respuesta.mensaje || 'No se pudo completar el registro.';
    }
  });

  /* ---------- Ingreso a "Mi recorrido" ---------- */

  const formularioSesion = $('inicio-sesion-form');
  formularioSesion.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formularioSesion);

    const documento = $('doc-sesion').value.trim();
    const clave = $('clave-sesion').value;
    let hayError = false;
    if (!EXPRESION_DOCUMENTO.test(documento)) {
      ponerError('doc-sesion', 'Escribe tu documento: solo números.');
      hayError = true;
    }
    if (!clave) {
      ponerError('clave-sesion', 'Escribe tu contraseña.');
      hayError = true;
    }
    if (hayError) return;

    const boton = $('btn-entrar');
    boton.disabled = true;
    const { estado, datos } = await pedir('/api/login', { numero_identificacion: documento, contrasena: clave });
    boton.disabled = false;
    $('clave-sesion').value = ''; // la contraseña no se queda escrita en la pantalla

    if (estado === 200 && datos.ok) {
      formularioSesion.reset();
      $('clave-sesion').type = 'password';
      mostrarRecorrido(datos);
      return;
    }
    $('error-general-sesion').textContent = datos.mensaje || `Error inesperado (código ${estado}). Avisa a un guía.`;
  });

  /* ---------- Mi recorrido ---------- */

  function crearPiezaDescubierta(p) {
    const item = crear('li', 'pieza-descubierta');
    const detalles = document.createElement('details');

    const resumen = document.createElement('summary');
    resumen.append(crear('span', '', p.pieza), crear('span', 'pieza-puntos', `+${p.puntos} pts`));

    const cuerpo = crear('div', 'pieza-detalle');
    const filas = [['Época', p.periodo], ['Material', p.material], ['Procedencia', p.procedencia], ['Tamaño', p.dimensiones]]
      .filter(([, valor]) => valor);
    if (filas.length > 0) {
      const lista = crear('dl', 'ficha-original');
      filas.forEach(([etiqueta, valor]) => lista.append(crear('dt', '', etiqueta), crear('dd', '', valor)));
      cuerpo.append(lista);
    }
    if (p.historia) cuerpo.append(crear('p', '', p.historia));
    if (p.fuente) cuerpo.append(crear('p', 'pieza-fuente', `Fuente: ${p.fuente}`));
    if (typeof p.video === 'string' && p.video.startsWith('/contenido/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.preload = 'none'; // no se descarga hasta que el niño le da play
      video.src = p.video;
      cuerpo.append(video);
    }

    detalles.append(resumen, cuerpo);
    item.append(detalles);
    return item;
  }

  function crearPiezaPendiente() {
    const item = crear('li', 'pieza-pendiente');
    const signo = crear('span', 'signo', '?');
    signo.setAttribute('aria-hidden', 'true');
    item.append(signo, crear('span', '', 'Pieza por descubrir'));
    return item;
  }

  function mostrarRecorrido(d) {
    const descubiertas = Array.isArray(d.descubiertas) ? d.descubiertas : [];
    const total = Math.max(Number(d.total_piezas) || 0, descubiertas.length);
    const hoy = Number(d.piezas_con_puntos_hoy) || 0;

    $('recorrido-saludo').textContent = `¡Hola, ${d.visitante.apodo}!`;
    $('recorrido-puntos').textContent = String(d.total_puntos);
    $('recorrido-posicion').textContent = d.posicion
      ? `Vas en el puesto ${d.posicion} de tu grado (${d.visitante.grado}).`
      : 'Aún no tienes puntos. ¡Busca las piezas con puntos de hoy!';
    $('recorrido-progreso').textContent = `Piezas con puntos que has descubierto: ${descubiertas.length} de ${total}`;
    $('recorrido-hoy').textContent = hoy === 0
      ? 'Hoy ninguna pieza suma puntos.'
      : `Hoy ${hoy === 1 ? 'suma puntos 1 pieza' : `suman puntos ${hoy} piezas`}.`;

    $('recorrido-lista').replaceChildren(
      ...descubiertas.map(crearPiezaDescubierta),
      ...Array.from({ length: total - descubiertas.length }, crearPiezaPendiente)
    );
    mostrarPantalla('pantalla-recorrido');
  }

  // Si el niño pliega una ficha, su video se pausa
  $('recorrido-lista').addEventListener('toggle', (e) => {
    if (e.target.tagName === 'DETAILS' && !e.target.open) e.target.querySelector('video')?.pause();
  }, true);
});