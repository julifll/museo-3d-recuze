const { randomInt } = require('crypto');

const ANIMALES = [
  ['Jaguar', 'm'], ['Caimán', 'm'], ['Venado', 'm'], ['Armadillo', 'm'],
  ['Garza', 'f'], ['Tortuga', 'f'], ['Nutria', 'f'], ['Oso Hormiguero', 'm'],
  ['Mono Aullador', 'm'], ['Loro Cabeza Azul', 'm'], ['Chigüiro', 'm'], ['Iguana', 'f'],
  ['Lagarto', 'm'], ['Rana', 'f'], ['Mariposa', 'f'], ['Colibrí', 'm'],
  ['Águila', 'f'], ['Búho', 'm'], ['Tucán', 'm'], ['Bagre', 'm'],
  ['Tití', 'm'], ['Zorro', 'm'], ['Guacamaya', 'f'], ['Ocelote', 'm'],
  ['Manatí', 'm'], ['Pelícano', 'm'], ['Cangrejo', 'm'], ['Perezoso', 'm']
];

// [forma masculina, forma femenina]. Sin colores, para no chocar con "Cabeza Azul".
const CUALIDADES = [
  ['Valiente', 'Valiente'], ['Veloz', 'Veloz'], ['Curioso', 'Curiosa'], ['Brillante', 'Brillante'],
  ['Sabio', 'Sabia'], ['Ágil', 'Ágil'], ['Tranquilo', 'Tranquila'], ['Atento', 'Atenta'],
  ['Audaz', 'Audaz'], ['Noble', 'Noble'], ['Fuerte', 'Fuerte'], ['Alegre', 'Alegre'],
  ['Astuto', 'Astuta'], ['Amable', 'Amable'], ['Paciente', 'Paciente'], ['Leal', 'Leal'],
  ['Creativo', 'Creativa'], ['Explorador', 'Exploradora'], ['Soñador', 'Soñadora'], ['Ingenioso', 'Ingeniosa'],
  ['Aventurero', 'Aventurera'], ['Generoso', 'Generosa'], ['Cuidadoso', 'Cuidadosa'], ['Divertido', 'Divertida'],
  ['Observador', 'Observadora']
];

// Todas las combinaciones posibles, calculadas una sola vez al arrancar
const TODOS = [];
for (const [animal, genero] of ANIMALES) {
  for (const cualidad of CUALIDADES) {
    TODOS.push(`${animal} ${cualidad[genero === 'f' ? 1 : 0]}`);
  }
}
const CONJUNTO = new Set(TODOS);

// ¿El texto es exactamente una combinación de nuestras listas? (el servidor no confía en el navegador)
function esApodoValido(texto) {
  return typeof texto === 'string' && CONJUNTO.has(texto);
}

// Devuelve `cantidad` apodos al azar que NO estén en `ocupados` (un Set de apodos ya usados)
function sugerirApodos(ocupados, cantidad = 3) {
  const libres = TODOS.filter((a) => !ocupados.has(a));
  const elegidos = [];
  while (elegidos.length < cantidad && libres.length > 0) {
    const i = randomInt(libres.length);
    elegidos.push(libres.splice(i, 1)[0]);
  }
  return elegidos;
}

module.exports = { esApodoValido, sugerirApodos, TOTAL_COMBINACIONES: TODOS.length };