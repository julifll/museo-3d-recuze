function crearLimitador(maxFallos, bloqueoMs) {
  const registros = new Map(); // clave -> { fallos, hasta, ultimo }

  return {
    estaBloqueado(clave) {
      const registro = registros.get(clave);
      if (!registro || !registro.hasta) return false;
      if (registro.hasta > Date.now()) return true;
      registros.delete(clave); // el bloqueo ya venció
      return false;
    },

    registrarFallo(clave) {
      const ahora = Date.now();
      let registro = registros.get(clave);
      // Fallos viejos (de hace más que el tiempo de bloqueo) se olvidan
      if (!registro || ahora - registro.ultimo > bloqueoMs) registro = { fallos: 0, hasta: 0, ultimo: ahora };
      registro.fallos += 1;
      registro.ultimo = ahora;
      if (registro.fallos >= maxFallos) registro.hasta = ahora + bloqueoMs;
      registros.set(clave, registro);
    },

    limpiar(clave) {
      registros.delete(clave);
    }
  };
}

module.exports = { crearLimitador };