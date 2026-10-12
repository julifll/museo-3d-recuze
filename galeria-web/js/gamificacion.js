/**
 * MÓDULO BÓVEDA ZENÚ - Gamificación (100% offline, red local)
 *
 * - Lee ?pieza=CODIGO (QR escaneado con el celular) y precarga el código.
 * - Valida contra el servidor: POST /api/descubrimientos (nada se valida en el cliente).
 * - Muestra puntos acumulados y ranking por grado.
 */

const ETIQUETAS_ERROR = {
  404: 'No encontrado',
  409: 'Ya descubierta',
  429: 'Espera un momento'
};

function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
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
    this.inputGrado = document.getElementById('grado'); // Captura el select del HTML

    if (!this.formulario || !this.inputDocumento || !this.inputCodigo || !this.resultado) {
      console.warn('Elementos de gamificación no encontrados en el DOM');
      return;
    }

    
    const pieza = new URLSearchParams(window.location.search).get('pieza');
    if (pieza) {
      this.inputCodigo.value = pieza.trim().toUpperCase().slice(0, 50);
      this.metodo = 'qr';
    }
    this.inputCodigo.addEventListener('input', () => { this.metodo = 'codigo_manual'; });

    
    this.formulario.addEventListener('submit', (e) => {
      e.preventDefault();
      this.validarAcceso();
    });

    const btnRanking = document.getElementById('btn-ver-ranking');
    btnRanking?.addEventListener('click', () => {
      this.cargarRanking();
    });

    this.cargarRanking();
  }

  async llamar(url, opciones) {
    try {
      const resp = await fetch(url, opciones);
      const datos = await resp.json().catch(() => ({}));
      return { estado: resp.status, datos };
    } catch (e) {
      return { estado: 0, datos: { mensaje: 'No hay conexión con el servidor del museo. Avisa a un guía.' } };
    }
  }

  async validarAcceso() {
    const documento = this.inputDocumento.value.trim();
    const codigo = this.inputCodigo.value.trim().toUpperCase();

    if (!documento || !codigo) {
      this.mostrarError('Por favor completa ambos campos: documento y código de la pieza.', 'Faltan datos');
      return;
    }
    
    
    if (!/^\d{6,20}$/.test(documento)) {
      this.mostrarError('El documento debe ser un número válido, sin puntos ni guiones.', 'Documento no válido');
      return; 
    }

    const btn = document.getElementById('btn-validar-gamificacion');
    if (btn) btn.disabled = true;
    
    const { estado, datos } = await this.llamar('http://localhost:3000/api/descubrimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_identificacion: documento, codigo, metodo: this.metodo })
    });
    
    if (btn) btn.disabled = false;

    if (estado === 201 && datos.ok) {
      this.mostrarRecompensa(datos);
      this.mostrarPuntos(datos.total_puntos);
      this.cargarRanking(); // Actualiza el ranking al sumar puntos
    } else {
      this.mostrarError(datos.mensaje || 'Ocurrió un error. Inténtalo de nuevo.', ETIQUETAS_ERROR[estado] || 'No se pudo registrar');
    }
    
    this.limpiarFormulario(estado === 201);
  }

  
  mostrar(html, clase, ms) {
    this.resultado.innerHTML = html;
    this.resultado.style.display = 'block';
    clearTimeout(this.temporizador);
    
    if (ms > 0) {
      this.temporizador = setTimeout(() => {
        this.resultado.style.display = 'none';
        this.resultado.innerHTML = '';
      }, ms);
    }
  }

  mostrarRecompensa(d) {
    this.mostrar(`
      <div class="gamificacion-resultado exito">
        <h3 class="resultado-titulo">¡Descubrimiento desbloqueado!</h3>
        
        <img src="${escaparHTML(d.imagen)}" alt="${escaparHTML(d.pieza)}" style="max-width: 100%; height: auto; border-radius: 12px; margin: 15px 0; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        
        <p class="resultado-pieza" style="font-size: 1.3rem; color: var(--color-marron);"><strong>${escaparHTML(d.pieza)}</strong></p>
        
        <p style="font-size: 0.95rem; color: #424346; text-align: left; line-height: 1.6; margin-bottom: 20px;">
          ${escaparHTML(d.historia)}
        </p>
        
        <div class="resultado-puntos" style="margin-bottom: 15px;">
          <span class="puntos-valor">+${escaparHTML(d.puntos)}</span>
          <span class="puntos-etiqueta">puntos</span>
        </div>

        <button type="button" class="btn-primary" onclick="document.getElementById('gamificacion-resultado').style.display='none'" style="width: 100%;">
          Cerrar y continuar
        </button>
      </div>`, 'exito', 0); // 0 = tiempo infinito
  }

  mostrarError(mensaje, titulo) {
    this.mostrar(`
      <div class="gamificacion-resultado error">
        <div class="resultado-icono">❌</div>
        <h3 class="resultado-titulo">${escaparHTML(titulo)}</h3>
        <p class="resultado-mensaje">${escaparHTML(mensaje)}</p>
      </div>`, 'error', 8000); // 8 segundos para errores
  }

  mostrarPuntos(total) {
    if (!this.panelPuntos) return;
    this.panelPuntos.hidden = false;
    this.panelPuntos.innerHTML = `<h3>Tus puntos acumulados</h3><p class="puntos-total">${escaparHTML(total)} pts</p>`;
  }

  
  async cargarRanking() {
    if (!this.listaRanking) return;
    const grado = this.inputGrado?.value.trim() || '';
    
    const { datos } = await this.llamar('http://localhost:3000/api/ranking' + (grado ? `?grado=${encodeURIComponent(grado)}` : ''));
    
    const lista = Array.isArray(datos.ranking) ? datos.ranking : [];
    this.listaRanking.innerHTML = lista.length
      ? lista.map((r) => `<li><span>${escaparHTML(r.nombre)}${r.grado ? ` (${escaparHTML(r.grado)})` : ''}</span> <strong>${escaparHTML(r.total_puntos)} pts</strong></li>`).join('')
      : '<li>Aún no hay puntajes.</li>';
  }

  
  limpiarFormulario(borrarDocumento) {
    this.inputCodigo.value = '';
    this.metodo = 'codigo_manual';
    if (borrarDocumento) {
      this.inputDocumento.value = '';
    } 
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.bovedaZenu = new BovedaZenu();
});