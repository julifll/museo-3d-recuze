document.addEventListener('DOMContentLoaded', () => {
  const screens = Array.from(document.querySelectorAll('.screen'));
  let visitantRegistrado = {};

  /*Función para obtener fecha y hora*/
  function obtenerFechaHora() {
    const ahora = new Date();
    
    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const anio = ahora.getFullYear();
    
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    const segundos = String(ahora.getSeconds()).padStart(2, '0');
    
    return {
      fecha: `${dia}/${mes}/${anio}`,
      hora: `${horas}:${minutos}:${segundos}`,
      fechaCompleta: `${dia}/${mes}/${anio} a las ${horas}:${minutos}:${segundos}`
    };
  }

  
  /*Función de navegación*/
  function showScreen(id) {
    // Remueve la clase 'active' de TODAS las pantallas
    screens.forEach(screen => {
      screen.classList.remove('active');
    });
    
    // Agrega la clase 'active' SOLO a la pantalla solicitada
    const targetScreen = document.getElementById(id);
    if (targetScreen) {
      targetScreen.classList.add('active');
      console.log(`Pantalla activa: ${id}`);
    } else {
      console.warn(`Pantalla no encontrada: ${id}`);
    }
  }

  const clearFormErrors = (form) => {
    form.querySelectorAll('.field-error').forEach(error => {
      error.textContent = '';
    });

    form.querySelectorAll('input').forEach(input => {
      input.classList.remove('invalid');
    });
  };

  const setFieldError = (fieldName, message) => {
    const input = document.querySelector(`[name="${fieldName}"]`);
    const error = document.getElementById(`error-${fieldName}`);

    if (input) {
      input.classList.add('invalid');
    }

    if (error) {
      error.textContent = message;
    }
  };

  // Llama al servidor con rutas relativas (funciona desde cualquier IP de la LAN)
  async function enviar(url, cuerpo) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
      });
      const datos = await resp.json().catch(() => ({}));
      return { ok: resp.ok && datos.ok, estado: resp.status, datos };
    } catch (e) {
      return { ok: false, estado: 0, datos: { mensaje: 'No hay conexión con el servidor del museo.' } };
    }
  }

  function mostrarErroresServidor(datos) {
    const errores = datos.errores || {};
    const campos = Object.keys(errores);
    campos.forEach((campo) => setFieldError(campo, errores[campo]));
    if (!campos.length) {
      const general = document.getElementById('error-general-registro');
      if (general) general.textContent = datos.mensaje || 'No se pudo completar el registro.';
    }
  }

  document.getElementById('btn-iniciar-registro')?.addEventListener('click', () => {
    showScreen('pantalla-registro');
  });

  document.getElementById('btn-iniciar-sesion')?.addEventListener('click', () => {
    showScreen('pantalla-inicio-sesion');
  });

  document.getElementById('btn-cancelar')?.addEventListener('click', () => {
    showScreen('pantalla-bienvenida');
  });

  document.getElementById('btn-cancelar-sesion')?.addEventListener('click', () => {
    showScreen('pantalla-bienvenida');
  });

  document.getElementById('btn-volver-inicio')?.addEventListener('click', () => {
    visitantRegistrado = {};
    showScreen('pantalla-bienvenida');
  });

  const registerForm = document.getElementById('registro-visitantes-form');

  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(registerForm);
    const generalError = document.getElementById('error-general-registro');
    if (generalError) generalError.textContent = '';

    const data = new FormData(registerForm);
    const nombre = String(data.get('nombre') || '').trim();
    const apellido = String(data.get('apellido') || '').trim();
    const residencia = String(data.get('lugar_residencia') || '').trim();
    const edad = Number(data.get('edad'));
    const numeroIdentificacion = String(data.get('numero_identificacion') || '').trim();
    const correo = String(data.get('correo') || '').trim();
    const contrasena = String(data.get('contrasena') || '').trim();
    const grado = String(data.get('grado') || '').trim();
    const autoriza = data.get('autoriza_datos') === 'on';

    let hasError = false;

    if (!nombre || nombre.length < 2) {
      setFieldError('nombre', 'Escribe tu nombre completo.');
      hasError = true;
    }

    if (!apellido || apellido.length < 2) {
      setFieldError('apellido', 'Escribe tu apellido.');
      hasError = true;
    }

    if (!residencia || residencia.length < 3) {
      setFieldError('lugar_residencia', 'Indica tu lugar de residencia.');
      hasError = true;
    }

    if (!Number.isInteger(edad) || edad < 1 || edad > 120) {
      setFieldError('edad', 'La edad debe ser un número válido.');
      hasError = true;
    }

    if (!/^\d{6,20}$/.test(numeroIdentificacion)) {
      setFieldError('numero_identificacion', 'Ingresa un número de identificación válido.');
      hasError = true;
    }

    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
    if (!correoValido) {
      setFieldError('correo', 'Ingresa un correo electrónico válido.');
      hasError = true;
    }

    if (!contrasena || contrasena.length < 4 || contrasena.length > 8) {
      setFieldError('contrasena', 'La contraseña debe tener entre 4 y 8 caracteres.');
      hasError = true;
    }

    if (!autoriza) {
      setFieldError('autoriza_datos', 'Debes autorizar el tratamiento de tus datos.');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    const fechaHora = obtenerFechaHora();
    const resp = await enviar('http://localhost:3000/api/visitantes', {
      nombre, apellido, lugar_residencia: residencia, edad,
      numero_identificacion: numeroIdentificacion, correo, contrasena, grado, autoriza_datos: true
    });

    if (!resp.ok) {
      mostrarErroresServidor(resp.datos);
      return;
    }

    visitantRegistrado = { nombre: `${nombre} ${apellido}` };
    registerForm.reset();

    document.getElementById('registro-exito-nombre').textContent = `Registrado el ${fechaHora.fechaCompleta}`;
    document.getElementById('exito-titulo').textContent = `¡Bienvenido, ${nombre}!`;

    showScreen('pantalla-exito');
  });

  const loginForm = document.getElementById('inicio-sesion-form');

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(loginForm);

    const emailValue = String(document.getElementById('correo_sesion')?.value || '').trim();
    const codeValue = String(document.getElementById('codigo-acceso')?.value || '').trim();

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
    if (!emailOk) {
      setFieldError('correo_sesion', 'Ingresa un correo válido.');
    }

    if (!codeValue || codeValue.length < 4) {
      setFieldError('codigo-acceso', 'El código debe tener al menos 4 caracteres.');
    }

    if (!emailOk || !codeValue || codeValue.length < 4) {
      return;
    }

    const fechaHora = obtenerFechaHora();
    const resp = await enviar('http://localhost:3000/api/login', { correo: emailValue, contrasena: codeValue });

    if (!resp.ok) {
      const campo = resp.estado === 401 || resp.estado === 429 ? 'codigo-acceso' : null;
      const mensaje = resp.datos.mensaje || 'No se pudo iniciar sesión.';
      if (campo) setFieldError(campo, mensaje);
      else setFieldError('correo_sesion', mensaje);
      return;
    }

    visitantRegistrado = { nombre: `${resp.datos.visitante.nombre} ${resp.datos.visitante.apellido}` };
    loginForm.reset();

    document.getElementById('registro-exito-nombre').textContent = `Inicio de sesión registrado el ${fechaHora.fechaCompleta}`;
    document.getElementById('exito-titulo').textContent = '¡Sesión iniciada correctamente!';

    showScreen('pantalla-exito');
  });
});