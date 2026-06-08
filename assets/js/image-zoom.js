(function () {
  const overlay = document.getElementById('image-zoom-overlay');
  const target = document.getElementById('image-zoom-target');
  if (!overlay || !target) return;

  const open = (img) => {
    target.src = img.currentSrc || img.src;
    target.alt = img.alt || '';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    target.removeAttribute('src');
    document.body.style.overflow = '';
  };

  document.querySelectorAll('.post-content figure img').forEach((img) => {
    img.classList.add('zoomable-image');
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Click to zoom image');

    img.addEventListener('click', () => open(img));
    img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(img);
      }
    });
  });

  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
})();
