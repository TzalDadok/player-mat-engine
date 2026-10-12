(() => {
  document.addEventListener('click', event => {
    const btn = event.target.closest('.promote-btn');
    if (!btn) return;

    if (btn.dataset.busy === '1') {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    btn.dataset.busy = '1';
    btn.disabled = true;
    btn.textContent = '…';

    // Si por cualquier motivo la operación falla y la UI no se redibuja,
    // permitir reintentar después de unos segundos.
    setTimeout(() => {
      if (document.body.contains(btn)) {
        btn.dataset.busy = '0';
        btn.disabled = false;
        btn.textContent = '→';
      }
    }, 10000);
  }, true);
})();