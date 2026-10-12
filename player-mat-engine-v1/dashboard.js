(() => {
  const GH = {
    owner: 'TzalDadok',
    repo: 'player-mat-engine',
    branch: 'main',
    tokenKey: 'aoe-dashboard-github-token',
    paths: {
      testing: 'player-mat-engine-v1/data/en-prueba.json',
      changelog: 'player-mat-engine-v1/data/changelog.json'
    }
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

  const state = { testing: [], changelog: [] };

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

  const getToken = () => {
    let token = localStorage.getItem(GH.tokenKey) || '';
    if (token) return token;

    token = window.prompt('Pegá tu token de GitHub para habilitar el guardado. Se guarda sólo en este navegador:') || '';
    token = token.trim();
    if (!token) throw new Error('No se ingresó token.');
    localStorage.setItem(GH.tokenKey, token);
    return token;
  };

  const clearToken = () => localStorage.removeItem(GH.tokenKey);

  const apiHeaders = () => ({
    'Accept': 'application/vnd.github+json',
    'Authorization': 'Bearer ' + getToken(),
    'X-GitHub-Api-Version': '2022-11-28'
  });

  const apiUrl = type =>
    'https://api.github.com/repos/' + GH.owner + '/' + GH.repo + '/contents/' + GH.paths[type];

  const decodeBase64Utf8 = b64 => {
    const bytes = Uint8Array.from(atob(b64.replace(/\n/g,'')), c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  };

  const encodeBase64Utf8 = text => {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  };

  const getFile = async type => {
    const r = await fetch(apiUrl(type) + '?ref=' + encodeURIComponent(GH.branch) + '&t=' + Date.now(), {
      headers: apiHeaders(),
      cache: 'no-store'
    });

    if (r.status === 401 || r.status === 403) {
      clearToken();
      throw new Error('TOKEN_INVALID');
    }

    if (!r.ok) throw new Error('GitHub GET ' + r.status);

    const file = await r.json();
    return {
      sha: file.sha,
      data: JSON.parse(decodeBase64Utf8(file.content))
    };
  };

  const putFile = async (type, data, sha, message) => {
    const r = await fetch(apiUrl(type), {
      method: 'PUT',
      headers: {
        ...apiHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        content: encodeBase64Utf8(JSON.stringify(data, null, 2) + '\n'),
        sha,
        branch: GH.branch
      })
    });

    if (r.status === 401 || r.status === 403) {
      clearToken();
      throw new Error('TOKEN_INVALID');
    }

    if (!r.ok) throw new Error('GitHub PUT ' + r.status);
    return r.json();
  };

  const setStatus = (type, text, keep = false) => {
    els[type].status.textContent = text;
    clearTimeout(els[type].status._timer);
    if (!keep) {
      els[type].status._timer = setTimeout(() => {
        els[type].status.textContent = '';
      }, 2200);
    }
  };

  const render = type => {
    const notes = state[type];
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

      const remove = type === 'changelog'
        ? '<button class="delete-btn" type="button" data-delete="' + originalIndex + '" title="Eliminar del Changelog">×</button>'
        : '';

      const date = type === 'changelog'
        ? (note.implementedAt || note.createdAt)
        : note.createdAt;

      return `
        <article class="note ${type === 'changelog' ? 'readonly-note' : ''}">
          <div class="note-meta">
            <span class="meta-left">${esc(formatDate(date))}</span>
            ${promote}${remove}
          </div>
          <div class="note-body">${esc(note.text)}</div>
        </article>
      `;
    }).join('');

    if (type === 'testing') {
      list.querySelectorAll('[data-promote]').forEach(btn => {
        btn.addEventListener('click', () => promoteNote(Number(btn.dataset.promote)));
      });
    }

    if (type === 'changelog') {
      list.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deleteChangelogNote(Number(btn.dataset.delete)));
      });
    }
  };

  const loadPublicData = async () => {
    try {
      const [testingFile, changelogFile] = await Promise.all([
        getFile('testing'),
        getFile('changelog')
      ]);

      state.testing = Array.isArray(testingFile.data) ? testingFile.data : [];
      state.changelog = Array.isArray(changelogFile.data) ? changelogFile.data : [];
      render('testing');
      render('changelog');
    } catch (err) {
      console.error(err);
      setStatus(
        'testing',
        err.message === 'TOKEN_INVALID' ? 'Token inválido. Volvé a intentar.' : 'Error al cargar',
        true
      );
      setStatus('changelog', 'Error al cargar', true);
    }
  };

  const addTestingNote = async text => {
    setStatus('testing', 'Guardando…', true);

    try {
      const file = await getFile('testing');
      const note = {
        id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
        text,
        createdAt: new Date().toISOString()
      };
      const next = [...file.data, note];

      await putFile('testing', next, file.sha, 'Add testing note');

      state.testing = next;
      els.testing.input.value = '';
      render('testing');
      setStatus('testing', 'Guardado');
    } catch (err) {
      console.error(err);
      setStatus('testing', err.message === 'TOKEN_INVALID' ? 'Token inválido. Volvé a intentar.' : 'Error al guardar', true);
    }
  };

  const promoteNote = async index => {
    const localNote = state.testing[index];
    if (!localNote) return;

    setStatus('testing', 'Implementando…', true);
    setStatus('changelog', 'Actualizando…', true);

    try {
      const [testingFile, changelogFile] = await Promise.all([
        getFile('testing'),
        getFile('changelog')
      ]);

      const currentIndex = testingFile.data.findIndex(n =>
        (localNote.id && n.id === localNote.id) ||
        (!localNote.id && n.text === localNote.text && n.createdAt === localNote.createdAt)
      );

      if (currentIndex < 0) throw new Error('La nota ya no existe.');

      const promoted = {
        ...testingFile.data[currentIndex],
        implementedAt: new Date().toISOString()
      };

      const nextChangelog = [...changelogFile.data, promoted];

      await putFile(
        'changelog',
        nextChangelog,
        changelogFile.sha,
        'Implement tested change'
      );

      const refreshedTesting = await getFile('testing');
      const removeIndex = refreshedTesting.data.findIndex(n =>
        (promoted.id && n.id === promoted.id) ||
        (!promoted.id && n.text === promoted.text && n.createdAt === promoted.createdAt)
      );

      const nextTesting = refreshedTesting.data.filter((_, i) => i !== removeIndex);

      await putFile(
        'testing',
        nextTesting,
        refreshedTesting.sha,
        'Remove implemented testing note'
      );

      state.testing = nextTesting;
      state.changelog = nextChangelog;
      render('testing');
      render('changelog');
      setStatus('testing', 'Implementado');
      setStatus('changelog', 'Agregado');
    } catch (err) {
      console.error(err);
      const message = err.message === 'TOKEN_INVALID' ? 'Token inválido. Volvé a intentar.' : 'Error al implementar';
      setStatus('testing', message, true);
      setStatus('changelog', '', false);
      await loadPublicData();
    }
  };

  const deleteChangelogNote = async index => {
    const localNote = state.changelog[index];
    if (!localNote) return;

    if (!window.confirm('¿Eliminar esta entrada del Changelog?')) return;

    setStatus('changelog', 'Eliminando…', true);

    try {
      const file = await getFile('changelog');

      const sameNote = n =>
        (localNote.id && n.id === localNote.id) ||
        (!localNote.id && n.text === localNote.text && n.createdAt === localNote.createdAt);

      const removeIndex = file.data.findIndex(sameNote);

      if (removeIndex < 0) {
        state.changelog = file.data;
        render('changelog');
        setStatus('changelog', 'Ya estaba eliminada');
        return;
      }

      const next = file.data.filter((_, i) => i !== removeIndex);

      await putFile(
        'changelog',
        next,
        file.sha,
        'Delete changelog entry'
      );

      state.changelog = next;
      render('changelog');
      setStatus('changelog', 'Eliminado');
    } catch (err) {
      console.error(err);
      setStatus(
        'changelog',
        err.message === 'TOKEN_INVALID' ? 'Token inválido. Volvé a intentar.' : 'Error al eliminar',
        true
      );
      await loadPublicData();
    }
  };

  const form = document.querySelector('.note-form[data-type="testing"]');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = els.testing.input.value.trim();
      if (!text) return;

      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      els.testing.input.disabled = true;

      await addTestingNote(text);

      button.disabled = false;
      els.testing.input.disabled = false;
      els.testing.input.focus();
    });
  }

  loadPublicData();
})();