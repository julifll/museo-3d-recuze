-- Piezas del Museo 3D ReCuZe (8 piezas, con fichas del objeto original).
-- Las rutas son relativas a /contenido/.
-- SOLO para una base NUEVA o de PRUEBA: borra las piezas y los puntos que existan.
-- NO lo ejecutes sobre la base que ya estás usando.

-- 1) Columnas nuevas (ejecutar una sola vez)
ALTER TABLE pieza3d
  ADD COLUMN slug VARCHAR(40) NULL AFTER id_pieza,
  ADD COLUMN ruta_video VARCHAR(100) NULL AFTER ruta_imagen,
  ADD COLUMN suma_puntos TINYINT(1) NOT NULL DEFAULT 0 AFTER puntos,
  ADD COLUMN activa TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN periodo VARCHAR(90) NULL,
  ADD COLUMN material_original VARCHAR(90) NULL,
  ADD COLUMN procedencia VARCHAR(90) NULL,
  ADD COLUMN dimensiones VARCHAR(60) NULL,
  ADD COLUMN fuente VARCHAR(200) NULL;

-- 2) Borra piezas viejas y los puntos que dependen de ellas
DELETE FROM registrogamificacion;
DELETE FROM pieza3d;
ALTER TABLE pieza3d AUTO_INCREMENT = 1;

-- 3) Con la tabla vacía, el slug pasa a ser obligatorio y único
ALTER TABLE pieza3d MODIFY slug VARCHAR(40) NOT NULL, ADD UNIQUE KEY uq_pieza_slug (slug);

-- 4) Las 8 piezas.
--    suma_puntos = 1: la pieza da puntos hoy (el profesor lo cambia cada día).
--    periodo, material_original, procedencia, dimensiones y fuente describen el objeto ORIGINAL.
INSERT INTO pieza3d
  (slug, nombre_pieza, categoria, resena_historica, ruta_imagen, ruta_video, codigo_qr, puntos, suma_puntos,
   periodo, material_original, procedencia, dimensiones, fuente) VALUES

('punta-baston-ave', 'Punta de bastón con figura de ave', 'Orfebrería',
 'El original es un remate de bastón con forma de ibis en vuelo, un ave de pico largo y curvo que busca pequeños animales en pantanos poco profundos. Los artistas zenúes la representaron con patas y cuerpo gruesos, casi como los de un pato, y con una cresta rizada.',
 'imagenes/punta-baston-ave.jpg', NULL, 'AVE-47', 50, 1,
 'Zenú Temprano, 200 a.C. – 1000 d.C.', 'Orfebrería', 'Colombia', '6,5 cm de alto × 5,1 cm de ancho',
 'Museo del Oro, Banco de la República · Registro O06447 («Remate de bastón horizontal zoomorfo»)'),

('punta-baston-caiman', 'Punta de bastón con figura de caimán', 'Orfebrería',
 'Réplica impresa en 3D. Texto histórico por completar con el docente.',
 'imagenes/punta-baston-caiman.jpg', 'videos/punta-baston-caiman.mp4', 'CAI-83', 50, 1,
 NULL, NULL, NULL, NULL, NULL),

('cilindro-tatuajes', 'Cilindro para tatuajes', 'Cerámica',
 'Réplica impresa en 3D. Texto histórico por completar con el docente.',
 'imagenes/cilindro-tatuajes.jpg', NULL, 'TAT-29', 50, 0,
 NULL, NULL, NULL, NULL, NULL),

('colgante-figura', 'Colgante con figura', 'Orfebrería',
 'Réplica impresa en 3D. Texto histórico por completar con el docente.',
 'imagenes/colgante-figura.jpg', NULL, 'FIG-61', 50, 0,
 NULL, NULL, NULL, NULL, NULL),

('colgante-flecha', 'Colgante flecha', 'Orfebrería',
 'Entre los siglos V y X, un mismo estilo de orfebrería, que el investigador Warwick Bray llamó «Grupo internacional», se extendió por el norte de Colombia, Panamá y Costa Rica. Sus figuras humanas con tocado bifurcado muestran influencia del estilo quimbayoide. La versión con cuerpo de crustáceo parece propia del Caribe colombiano.',
 'imagenes/colgante-flecha.jpg', NULL, 'FLE-15', 50, 0,
 'Zenú Temprano, 200 a.C. – 1000 d.C.', 'Orfebrería', 'San Marcos, Sucre', '3,9 cm de alto × 3,9 cm de ancho',
 'Museo del Oro, Banco de la República · Colgante, registro O33275 (pieza de referencia del estilo)'),

('orejera-semicircular', 'Orejera semicircular', 'Orfebrería',
 'Se hizo con la técnica de la cera perdida: el orfebre modelaba la pieza en cera de abejas, la cubría con un molde de arcilla, derretía la cera y vertía el metal fundido en ese espacio. Las cuatro aves que la adornan son garzas, que ajustan su reproducción a los ciclos del agua.',
 'imagenes/orejera-semicircular.jpg', 'videos/orejera-semicircular.mp4', 'ORE-72', 50, 1,
 'Tradición Zenú, 200 a.C. – 1600 d.C.', 'Orfebrería (tumbaga, una aleación de oro y cobre)', 'San Marcos, Sucre', '3,9 cm de alto × 7,2 cm de ancho',
 'Museo del Oro, Banco de la República · Registro O24316'),

('zoomorfa-espirales', 'Zoomorfa con espirales', 'Orfebrería',
 'Réplica impresa en 3D. Texto histórico por completar con el docente.',
 'imagenes/zoomorfa-espirales.jpg', NULL, 'ESP-58', 50, 0,
 NULL, NULL, NULL, NULL, NULL),

('zoomorfa-tubo', 'Zoomorfa con tubo', 'Orfebrería',
 'Réplica impresa en 3D. Texto histórico por completar con el docente.',
 'imagenes/zoomorfa-tubo.jpg', NULL, 'TUB-19', 50, 0,
 NULL, NULL, NULL, NULL, NULL);