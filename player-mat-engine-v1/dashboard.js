(() => {
  const items = [
    {id:'testingNotes', key:'aoe-boardgame-testing', status:'testingStatus'},
    {id:'changelogNotes', key:'aoe-boardgame-changelog', status:'changelogStatus'}
  ];

  const flash = (id, text) => {
    const el = document.getElementById(id);
    el.textContent = text;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.textContent = '', 1800);
  };

  items.forEach(item => {
    const el = document.getElementById(item.id);
    el.value = localStorage.getItem(item.key) || '';
  });

  document.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = items.find(x => x.id === btn.dataset.save);
      const el = document.getElementById(item.id);
      localStorage.setItem(item.key, el.value);
      const now = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      flash(item.status, 'Guardado ' + now);
    });
  });

  document.querySelectorAll('[data-clear]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = items.find(x => x.id === btn.dataset.clear);
      const el = document.getElementById(item.id);
      el.value = '';
      localStorage.removeItem(item.key);
      flash(item.status, 'Limpio');
    });
  });

  items.forEach(item => {
    const el = document.getElementById(item.id);
    el.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        localStorage.setItem(item.key, el.value);
        flash(item.status, 'Guardado');
      }
    });
  });
})();