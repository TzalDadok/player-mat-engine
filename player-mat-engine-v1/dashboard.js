(() => {
  const endpoints = {
    testing: 'data/en-prueba.json',
    changelog: 'data/changelog.json'
  };

  const els = {
    testing: {
      input: document.getElementById('testingInput'),
      list: document.getElementById('testingList'),
      status: document.getElementById('testingStatus')
    },
    changelog: {
      input: document.getElementById('changelogInput'),
      list: document.getElementById('changelogList'),
      status: document.getElementById('changelogStatus')
    }
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));

  const formatDate = value => {
    try {
      return new Intl.DateTimeFormat('es-UY', {
        dateStyle:'short',
        timeStyle:'short'
      }).format(new Date(value));
    } catch {
      return value || '';
    }
  };

  const render = (type, notes) => {
    const list = els[type].list;
    if (!notes.length) {
      list.innerHTML = '<div class="empty">Todavía no hay notas.</div>';
      return;
    }

    list.innerHTML = notes.slice().reverse().map(note => `
      <article class="note">
        <div class="note-meta">
          <span>${esc(formatDate(note.createdAt))}</span>
        </div>
        <div class="note-body">${esc(note.text)}</div>
      </article>
    `).join('');
  };

  const load = async type => {
    try {
      const r = await fetch(endpoints[type] + '?v=' + Date.now(), {cache:'no-store'});
      if (!r.ok) throw new Error('No se pudo cargar');
      const data = await r.json();
      render(type, Array.isArray(data) ? data : []);
    } catch {
      render(type, []);
      els[type].status.textContent = 'Sin conexión al archivo';
    }
  };

  document.querySelectorAll('.note-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const type = form.dataset.type;
      const text = els[type].input.value.trim();
      if (!text) return;

      const temp = {
        text,
        createdAt: new Date().toISOString()
      };

      const current = [...els[type].list.querySelectorAll('.note')].map(() => null);
      const existingHTML = els[type].list.innerHTML;
      els[type].list.innerHTML = `
        <article class="note">
          <div class="note-meta"><span>Sin guardar</span></div>
          <div class="note-body">${esc(text)}</div>
        </article>` + (existingHTML.includes('Todavía no hay notas.') ? '' : existingHTML);

      els[type].input.value = '';
      els[type].status.textContent = 'Pendiente de guardado remoto';

      // GitHub Pages es estático. La escritura remota se conectará aquí
      // cuando exista un endpoint autenticado/backend.
      window.setTimeout(() => {
        els[type].status.textContent = 'No guardado en GitHub';
      }, 1400);
    });
  });

  load('testing');
  load('changelog');
})();