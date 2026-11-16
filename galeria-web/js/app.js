/**
 * Galería: ventana de detalle de cada pieza.
 * Usa el elemento <dialog> del navegador: fondo oscuro, tecla Esc y foco atrapado vienen incluidos.
 */
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('modal-detalle');
  const catalogo = document.querySelector('.catalog-grid');
  if (!modal || !catalogo) return;

  const campos = {
    img: document.getElementById('modal-img'),
    tag: document.getElementById('modal-tag'),
    titulo: document.getElementById('modal-titulo'),
    descripcion: document.getElementById('modal-descripcion')
  };

  // Un solo oyente atiende todos los botones "Ver detalles" (marcados con data-detalle)
  catalogo.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-detalle]');
    if (!boton) return;

    const tarjeta = boton.closest('.pieza-card');
    const img = tarjeta.querySelector('img');

    // El GIF animado solo se descarga al abrir el detalle
    campos.img.src = img.dataset.animacion || img.src;
    campos.img.alt = img.alt;
    campos.tag.textContent = tarjeta.querySelector('.card-tag').textContent;
    campos.titulo.textContent = tarjeta.querySelector('h3').textContent;
    campos.descripcion.textContent = tarjeta.querySelector('p').textContent;

    modal.showModal();
  });

  // Tocar fuera del recuadro cierra la ventana (el fondo oscuro pertenece al <dialog>)
  modal.addEventListener('click', (evento) => {
    if (evento.target === modal) modal.close();
  });

  // Al cerrar se quita la imagen, para que un GIF no siga animándose por detrás
  modal.addEventListener('close', () => campos.img.removeAttribute('src'));
});