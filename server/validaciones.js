const { esApodoValido } = require('./apodos');

const GRADOS = [
  'pre-jardin', 'jardin', 'transicion', '1°',
  '2°-1', '2°-2', '3°-1', '3°-2', '4°-1', '4°-2', '5°-1', '5°-2',
  '6°-1', '6°-2', '7°-1', '7°-2', '8°-1', '8°-2', '9°-1', '9°-2',
  '10°', '11°'
];

const METODOS = ['qr', 'codigo_manual'];

// Reglas de la contraseña: deben coincidir con las del formulario del quiosco
const CLAVE_MIN = 4;
const CLAVE_MAX = 8;

const EXPRESION_DOCUMENTO = /^\d{6,20}$/;
const EXPRESION_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ¿Es un texto, y tiene un largo razonable (sin contar espacios de los extremos)?
function textoValido(valor, min, max) {
  return typeof valor === 'string' && valor.trim().length >= min && valor.trim().length <= max;
}

// El correo es OPCIONAL: vacío, ausente o null significa "no tiene". Si viene escrito, debe ser válido.
function correoEscrito(correo) {
  return typeof correo === 'string' && correo.trim() !== '';
}

// "ave47", "AVE 47" y "ave-47" se convierten en "AVE-47"
function normalizarCodigo(texto) {
  return String(texto ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^([A-Z]{3})-?(\d{2})$/, '$1-$2');
}

function validarRegistro(datos) {
  const errores = {};

  if (!textoValido(datos.nombre, 2, 50)) errores.nombre = 'Escribe tu nombre.';
  if (!textoValido(datos.apellido, 2, 50)) errores.apellido = 'Escribe tu apellido.';
  if (!textoValido(datos.lugar_residencia, 3, 100)) errores.lugar_residencia = 'Indica tu lugar de residencia.';

  if (!Number.isInteger(datos.edad) || datos.edad < 1 || datos.edad > 120) {
    errores.edad = 'La edad debe ser un número válido.';
  }

  if (typeof datos.numero_identificacion !== 'string' || !EXPRESION_DOCUMENTO.test(datos.numero_identificacion)) {
    errores.numero_identificacion = 'Ingresa un número de identificación válido.';
  }

  if (correoEscrito(datos.correo) && (datos.correo.trim().length > 100 || !EXPRESION_CORREO.test(datos.correo.trim()))) {
    errores.correo = 'Ese correo no es válido. Déjalo vacío si no tienes.';
  }

  if (typeof datos.contrasena !== 'string' || datos.contrasena.length < CLAVE_MIN || datos.contrasena.length > CLAVE_MAX) {
    errores.contrasena = `La contraseña debe tener entre ${CLAVE_MIN} y ${CLAVE_MAX} caracteres.`;
  }

  if (!esApodoValido(datos.apodo)) errores.apodo = 'Elige uno de los apodos de la lista.';

  if (!GRADOS.includes(datos.grado)) errores.grado = 'Elige un grado de la lista.';

  if (datos.autoriza_datos !== true) errores.autoriza_datos = 'Debes autorizar el tratamiento de tus datos.';

  return errores;
}

// Ingreso a "Mi recorrido": documento + contraseña. No se explican las reglas de la contraseña
// aquí; solo se revisa que lleguen textos razonables.
function validarLogin(datos) {
  const errores = {};

  if (typeof datos.numero_identificacion !== 'string' || !EXPRESION_DOCUMENTO.test(datos.numero_identificacion)) {
    errores.numero_identificacion = 'El documento debe ser un número, sin puntos ni guiones.';
  }
  if (typeof datos.contrasena !== 'string' || datos.contrasena.length === 0 || datos.contrasena.length > 50) {
    errores.contrasena = 'Escribe tu contraseña.';
  }

  return errores;
}

function validarDescubrimiento(datos) {
  const errores = {};

  if (!EXPRESION_DOCUMENTO.test(String(datos.numero_identificacion ?? ''))) {
    errores.numero_identificacion = 'El documento no es válido.';
  }
  if (!/^[A-Z0-9-]{3,20}$/.test(normalizarCodigo(datos.codigo))) {
    errores.codigo = 'El código no es válido.';
  }
  if (!METODOS.includes(datos.metodo)) {
    errores.metodo = 'El método de ingreso no es válido.';
  }

  return errores;
}

module.exports = { GRADOS, CLAVE_MIN, CLAVE_MAX, normalizarCodigo, correoEscrito, validarRegistro, validarLogin, validarDescubrimiento };
