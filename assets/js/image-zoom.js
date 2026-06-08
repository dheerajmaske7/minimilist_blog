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

  document.querySelectorAll('.post-content figure').forEach((figure) => {
    const img = figure.querySelector('img');
    if (!img) return;

    figure.classList.add('zoomable-figure');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'figure-zoom-btn';
    btn.setAttribute('aria-label', 'Expand image');
    btn.textContent = 'Expand';
    figure.appendChild(btn);

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      open(img);
    });

    img.addEventListener('click', () => open(img));
  });

  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
})();
