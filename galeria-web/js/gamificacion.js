/**
 * MÓDULO BÓVEDA ZENÚ - Gamificación (100% offline, red local)
 *
 * - Lee ?pieza=CODIGO (QR escaneado con el celular) y precarga el código.
 * - Valida contra el servidor: POST /api/descubrimientos (nada se valida en el cliente).
 * - Muestra puntos acumulados y ranking por grado.
 */

// Iconos dibujados con formas simples (sin tipografías de emojis, que fallan en equipos viejos)
const ICONOS = {
  estrella: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
  lupa: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.1" y2="16.1"/>',
  reloj: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  lapiz: '<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  aviso: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
};

// Respuestas del servidor que NO son fallos, sino situaciones normales del juego
const RESPUESTAS = {
  404: { titulo: 'No encontrado', icono: 'lupa', mensaje: 'No encontramos ese código. Revisa que esté bien escrito.' },
  409: { titulo: '¡Ya la tienes!', icono: 'estrella', mensaje: 'Ya descubriste esta pieza. ¡Busca otra para seguir sumando!' },
  429: { titulo: 'Espera un momento', icono: 'reloj', mensaje: 'Demasiados intentos. Espera unos minutos.' }
};

function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function svgIcono(nombre) {
  return `<svg class="resultado-svg" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre] ?? ICONOS.aviso}</svg>`;
}

// "ave47", "AVE 47" y "ave-47" se convierten en "AVE-47"
function normalizarCodigo(texto) {
  return String(texto ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^([A-Z]{3})-?(\d{2})$/, '$1-$2');
}

class BovedaZenu {
  constructor() {
    this.metodo = 'codigo_manual';
    this.temporizador = null;
    this.inicializar();
  }

  inicializar() {
    this.formulario = document.getElementById('gamificacion-formulario');
    this.inputDocumento = document.getElementById('gamificacion-documento');
    this.inputCodigo = document.getElementById('gamificacion-codigoqr');
    this.resultado = document.getElementById('gamificacion-resultado');
    this.panelPuntos = document.getElementById('gamificacion-puntos');
    this.listaRanking = document.getElementById('gamificacion-ranking');
    this.inputGrado = document.getElementById('grado');

    if (!this.formulario || !this.inputDocumento || !this.inputCodigo || !this.resultado) {
      console.warn('Elementos de gamificación no encontrados en el DOM');
      return;
    }

    const pieza = new URLSearchParams(window.location.search).get('pieza');
    if (pieza) {
      this.inputCodigo.value = normalizarCodigo(pieza).slice(0, 50);
      this.metodo = 'qr';
    }
    this.inputCodigo.addEventListener('input', () => { this.metodo = 'codigo_manual'; });

    this.formulario.addEventListener('submit', (e) => {
      e.preventDefault();
      this.validarAcceso();
    });

    this.inputGrado?.addEventListener('change', () => this.cargarRanking());

    // Un solo oyente en el contenedor atiende los botones "cerrar", aunque se vuelvan a crear
    this.resultado.addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar]')) this.cerrarResultado();
    });

    // Si el niño pliega "Ver el video", el video se pausa
    this.resultado.addEventListener('toggle', (e) => {
      if (e.target.tagName === 'DETAILS' && !e.target.open) e.target.querySelector('video')?.pause();
    }, true);

    this.cargarRanking();
  }

  async llamar(url, opciones) {
    try {
      const resp = await fetch(url, opciones);
      const datos = await resp.json().catch(() => ({}));
      return { estado: resp.status, datos };
    } catch {
      return { estado: 0, datos: { mensaje: 'No hay conexión con el servidor del museo. Avisa a un guía.' } };
    }
  }

  async validarAcceso() {
    const documento = this.inputDocumento.value.trim();
    const codigo = normalizarCodigo(this.inputCodigo.value);

    if (!documento || !codigo) {
      this.mostrarAviso({ titulo: 'Faltan datos', mensaje: 'Completa ambos campos: documento y código de la pieza.', icono: 'lapiz' });
      return;
    }

    if (!/^\d{6,20}$/.test(documento)) {
      this.mostrarAviso({ titulo: 'Documento no válido', mensaje: 'El documento debe ser un número, sin puntos ni guiones.', icono: 'lapiz' });
      return;
    }

    const btn = document.getElementById('btn-validar-gamificacion');
    if (btn) btn.disabled = true;

    const { estado, datos } = await this.llamar('/api/descubrimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_identificacion: documento, codigo, metodo: this.metodo })
    });

    if (btn) btn.disabled = false;

    if (estado === 200 && datos.ok && datos.suma_puntos === false) {
      // Pieza que hoy no suma puntos: solo se muestra su información
      this.mostrarRecompensa(datos);
      this.limpiarFormulario(false); // conserva el documento para consultar otra pieza
      return;
    }

    if (estado === 201 && datos.ok) {
      this.mostrarRecompensa(datos);
      this.mostrarPuntos(datos.total_puntos);
      this.cargarRanking();
    } else if (RESPUESTAS[estado]) {
      const { titulo, icono, mensaje } = RESPUESTAS[estado];
      this.mostrarAviso({ titulo, icono, mensaje: datos.mensaje || mensaje });
    } else {
      this.mostrarAviso({
        titulo: 'No se pudo registrar',
        mensaje: datos.mensaje || `Error inesperado (código ${estado}). Avisa a un guía.`,
        icono: 'aviso',
        tipo: 'error'
      });
    }

    this.limpiarFormulario(estado === 201);
  }

  mostrar(html, ms = 0) {
    this.resultado.innerHTML = html;
    clearTimeout(this.temporizador);
    if (ms > 0) this.temporizador = setTimeout(() => this.cerrarResultado(), ms);
  }

  // Cierra la tarjeta y detiene cualquier video que esté sonando
  cerrarResultado() {
    clearTimeout(this.temporizador);
    this.resultado.querySelectorAll('video').forEach((v) => v.pause());
    this.resultado.innerHTML = '';
  }

  // tipo: 'info' (situación normal del juego) o 'error' (falla real)
  mostrarAviso({ titulo, mensaje, icono = 'aviso', tipo = 'info' }) {
    this.mostrar(`
      <div class="gamificacion-resultado ${tipo}">
        <div class="resultado-icono">${svgIcono(icono)}</div>
        <h3 class="resultado-titulo">${escaparHTML(titulo)}</h3>
        <p class="resultado-mensaje">${escaparHTML(mensaje)}</p>
      </div>`, 8000);
  }

  mostrarRecompensa(d) {
    const sinPuntos = d.suma_puntos === false;
    const fila = (etiqueta, valor) =>
      valor ? `<div><dt>${etiqueta}</dt><dd>${escaparHTML(valor)}</dd></div>` : '';
    const hayFicha = d.periodo || d.material || d.procedencia || d.dimensiones;

    this.mostrar(`
      <div class="gamificacion-resultado exito">
        <h3 class="resultado-titulo">${sinPuntos ? 'Conoce esta pieza' : '¡Descubrimiento desbloqueado!'}</h3>
        <p class="resultado-pieza">${escaparHTML(d.pieza)}</p>

        ${hayFicha ? `
          <h4 class="ficha-titulo">Sobre el objeto original</h4>
          <dl class="ficha-original">
            ${fila('Época', d.periodo)}${fila('Material', d.material)}
            ${fila('Procedencia', d.procedencia)}${fila('Tamaño', d.dimensiones)}
          </dl>` : ''}

        <p class="recompensa-historia">${escaparHTML(d.historia)}</p>
        ${d.fuente ? `<p class="recompensa-fuente">Fuente: ${escaparHTML(d.fuente)}</p>` : ''}

        ${d.video ? `
          <details class="recompensa-video">
            <summary>Ver el video de los estudiantes</summary>
            <video controls playsinline preload="none">
              <source src="${escaparHTML(d.video)}" type="video/mp4">
            </video>
          </details>` : ''}

        ${sinPuntos
          ? '<p class="recompensa-aviso">Esta pieza hoy no suma puntos. Pregunta por las piezas con puntos de hoy.</p>'
          : `<div class="resultado-puntos">
               <span class="puntos-valor">+${escaparHTML(d.puntos)}</span>
               <span class="puntos-etiqueta">puntos</span>
             </div>`}

        <button type="button" class="btn-primary ancho-completo" data-cerrar>Cerrar y continuar</button>
      </div>`);
  }

  mostrarPuntos(total) {
    if (!this.panelPuntos) return;
    this.panelPuntos.hidden = false;
    this.panelPuntos.innerHTML = `<h3>Tus puntos acumulados</h3><p class="puntos-total">${escaparHTML(total)} pts</p>`;
  }

  async cargarRanking() {
    if (!this.listaRanking) return;
    const grado = this.inputGrado?.value.trim() || '';

    const { datos } = await this.llamar('/api/ranking' + (grado ? `?grado=${encodeURIComponent(grado)}` : ''));

    const lista = Array.isArray(datos.ranking) ? datos.ranking : [];
    this.listaRanking.innerHTML = lista.length
      ? lista.map((r) => `<li><span>${escaparHTML(r.apodo)}${r.grado ? ` (${escaparHTML(r.grado)})` : ''}</span> <strong>${escaparHTML(r.total_puntos)} pts</strong></li>`).join('')
      : '<li>Aún no hay puntajes.</li>';
  }

  limpiarFormulario(borrarDocumento) {
    this.inputCodigo.value = '';
    this.metodo = 'codigo_manual';
    if (borrarDocumento) this.inputDocumento.value = '';
  }
}

document.addEventListener('DOMContentLoaded', () => new BovedaZenu());