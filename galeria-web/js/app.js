document.addEventListener('DOMContentLoaded', () => {
  const heroButton = document.querySelector('.hero .btn-primary');

  if (heroButton) {
    heroButton.addEventListener('click', () => {
      window.scrollTo({
        top: document.querySelector('.catalogo').offsetTop,
        behavior: 'smooth'
      });
    });
  }
});