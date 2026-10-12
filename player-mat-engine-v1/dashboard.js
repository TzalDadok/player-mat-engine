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
      list.innerHTML = '<div class="empty">Todavía no hay entradas.</div>';
      return;
    }

    list.innerHTML = notes.slice().reverse().map((note, reverseIndex) => {
      const originalIndex = notes.length - 1 - reverseIndex;
      const promote = type === 'testing'
        ? '<button class="promote-btn" type="button" data-promote="' + originalIndex + '" title="Pasar a Changelog">→</button>'
        : '';

      return `
        <article class="note ${type === 'changelog' ? 'readonly-note' : ''}">
          <div class="note-meta">
            <span class="meta-left">${esc(formatDate(note.createdAt))}</span>
            ${promote}
          </div>
          <div class="note-body">${esc(note.text)}</div>
        </article>
      `;
    }).join('');

    if (type === 'testing') {
      list.querySelectorAll('[data-promote]').forEach(btn => {
        btn.addEventListener('click', () => {
          const note = notes[Number(btn.dataset.promote)];
          if (!note) return;

          navigator.clipboard?.writeText('Implementado: ' + note.text).catch(() => {});
          els.testing.status.textContent = 'Marcado para pasar a Changelog';
          setTimeout(() => els.testing.status.textContent = '', 2200);
        });
      });
    }
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

  const form = document.querySelector('.note-form[data-type="testing"]');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = els.testing.input.value.trim();
      if (!text) return;

      const existingHTML = els.testing.list.innerHTML;
      els.testing.list.innerHTML = `
        <article class="note">
          <div class="note-meta">
            <span class="meta-left">Sin guardar</span>
            <button class="promote-btn" type="button" title="Pasar a Changelog">→</button>
          </div>
          <div class="note-body">${esc(text)}</div>
        </article>` + (existingHTML.includes('Todavía no hay entradas.') ? '' : existingHTML);

      els.testing.input.value = '';
      els.testing.status.textContent = 'Pendiente de guardar en GitHub';
      setTimeout(() => els.testing.status.textContent = '', 2200);
    });
  }

  load('testing');
  load('changelog');
})();