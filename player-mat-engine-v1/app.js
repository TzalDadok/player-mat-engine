(() => {
  const civs = window.PLAYER_MAT_CIVS || {};
  const mat = document.getElementById('mat');
  const sidebar = document.getElementById('sidebar');
  const tree = document.getElementById('tree');
  let unitPanel = null;
  const select = document.getElementById('civSelect');

  const R = {food:'🥩', wood:'🪵', stone:'🪨', gold:'🪙'};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const costHTML = cost => {
    if (!cost) return '';
    return `<div class="costline">${Object.entries(cost).filter(([,v])=>v!==undefined).map(([k,v])=>`<span class="cost-item"><span class="ri">${R[k]||k}</span>${esc(v)}</span>`).join('')}</div>`;
  };
  const statsHTML = s => s ? `<div class="stats">${s.force!==undefined?`<span class="force">${s.force}</span>`:''}${s.range!==undefined?`<span class="range">${s.range}</span>`:''}${s.move!==undefined?`<span class="move">${s.move}</span>`:''}</div>` : '';

  function renderInlineCost(cost){
    if (!cost) return '';
    return `<span class="inline-cost">${Object.entries(cost).filter(([,v])=>v!==undefined).map(([k,v])=>`<span class="cost-item"><span class="ri">${R[k]||k}</span>${esc(v)}</span>`).join('')}</span>`;
  }

  function renderActionRow(row){
    if (row && row.kind === 'terrain') {
      return `<div class="action-row terrain-row"><b>${esc(row.label)}</b><div class="terrain-list">${row.items.map(item=>`<div class="terrain-item"><div class="terrain-top"><span class="terrain-name">${esc(item.name)}</span>${renderInlineCost(item.cost)}</div><div class="terrain-text">${esc(item.text)}</div></div>`).join('')}</div></div>`;
    }
    const [a,b] = row;
    return `<div class="action-row"><b>${esc(a)}</b><span>${esc(b)}</span></div>`;
  }

  function renderSidebar(c){
    const action = (num, cls, title, rows) => `<section class="action ${cls}"><div class="action-head"><span class="action-num">${num}</span><span>${title}</span><small>Elegí 1 acción</small></div><div class="action-body">${rows.map(renderActionRow).join('')}</div></section>`;
    sidebar.innerHTML = `<div class="sidebar-title"><b>TU TURNO</b><small>Realizá 1 acción de cada tipo, en orden.</small></div>
      ${action(1,'econ','ECONOMÍA',c.turn.economy)}
      ${action(2,'tech','TECNOLOGÍA',c.turn.technology)}
      ${action(3,'mil','MILITAR',c.turn.military)}`;
  }

  function nodeTextHTML(text){
    const safe = esc(text).replace(/\\n/g,'<br>');
    return safe.replace(/(Unidad disponible:[^.<]*(?:\.)?)/gi,'<strong>$1</strong>');
  }

  function nodeHTML(n){
    const embedded = n.embeddedUnit ? `<div class="embedded-unit"><div class="embedded-head"><span><b>Unidad:</b> ${esc(n.embeddedUnit.title)}</span>${costHTML(n.embeddedUnit.cost)}</div>${statsHTML(n.embeddedUnit.stats)}</div>` : '';
    return `<div class="node ${n.type}">${n.tag?`<div class="node-tag">${esc(n.tag)}</div>`:''}<div class="node-head"><div class="node-title">${esc(n.title)}</div>${costHTML(n.cost)}</div>${statsHTML(n.stats)}${n.text?`<div class="node-text">${nodeTextHTML(n.text)}</div>`:''}${embedded}</div>`;
  }

  function renderTree(c){
    tree.innerHTML = '';
    const corner = document.createElement('div'); corner.className='cell corner britones-corner'; tree.appendChild(corner);
    c.buildings.forEach((b,i)=>{
      const d=document.createElement('div'); d.className='cell building-head'+(b.unlock?' locked':''); d.style.gridColumn=String(i+2); d.style.gridRow='1';
      d.innerHTML=`<div class="name">${esc(b.name)}</div><img src="${esc(b.image)}" alt="">${b.cost?`<div class="building-cost">${costHTML(b.cost)}</div>`:""}`; tree.appendChild(d);
    });
    c.ages.forEach((a,ai)=>{
      const ac=document.createElement('div'); ac.className='cell age-cell'; ac.style.gridColumn='1'; ac.style.gridRow=String(ai+2);
      ac.innerHTML=`${a.image?`<img src="${esc(a.image)}" alt="">`:``}<span class="age-roman">${esc(a.roman)}</span><div class="age-info"><span class="age-text">${esc(a.name)}</span>${a.cost?costHTML(a.cost):``}</div>`; tree.appendChild(ac);
      c.buildings.forEach((b,bi)=>{
        const slot=document.createElement('div'); slot.className='cell slot'; slot.dataset.age=a.id; slot.dataset.building=b.id; slot.style.gridColumn=String(bi+2); slot.style.gridRow=String(ai+2);
        const nodes=c.nodes.filter(n=>n.age===a.id&&n.building===b.id); slot.innerHTML=nodes.length?nodes.map(nodeHTML).join(''):'<div class="empty"></div>';
        tree.appendChild(slot);
      });
    });
  }

  function renderUnits(c){
    if (unitPanel) unitPanel.remove();
    if (!c.unitReference) return;
    unitPanel=document.createElement('aside');
    unitPanel.className='unit-reference';
    const rows=c.unitReference.units.map(u=>`<div class="unit-ref-row"><b>${esc(u.name)}</b><span>${esc(u.force)}${u.forceUpgrade?` <em>(+${esc(u.forceUpgrade)})</em>`:''}</span><span>${esc(u.range)}</span><span>${esc(u.move)}</span></div>`).join('');
    const upgrades=c.unitReference.upgrades.map(x=>`<div class="unit-ref-note"><b>${esc(x.name)}</b> — ${esc(x.text)}</div>`).join('');
    const abilities=c.unitReference.abilities.map(x=>`<div class="unit-ref-note"><b>${esc(x.name)}</b> — ${esc(x.text)}</div>`).join('');
    unitPanel.innerHTML=`<div class="unit-ref-title">UNIDADES</div><div class="unit-ref-head"><span></span><span>⚔</span><span>◎</span><span>👣</span></div>${rows}<div class="unit-ref-section">MEJORAS</div>${upgrades}<div class="unit-ref-section">HABILIDADES</div>${abilities}`;
    mat.appendChild(unitPanel);
  }

  function render(id){
    const c=civs[id]; if(!c) return;
    // Physical player-mat size: fixed 14 cm height; width grows with the tech tree.
    const sidebarCm = 6.8;
    const ageCm = 3.6;
    const buildingCm = 4.2;
    const unitsCm = c.unitReference ? 4.0 : 0;
    mat.style.width = `${sidebarCm + ageCm + (c.buildings.length * buildingCm) + unitsCm}cm`;
    mat.style.height = '15.6cm';
    mat.style.setProperty('--sidebar-w', `${sidebarCm}cm`);
    tree.style.gridTemplateColumns = `${ageCm}cm repeat(${c.buildings.length}, ${buildingCm}cm)`;
    tree.style.right = `${unitsCm}cm`;
    renderSidebar(c); renderTree(c); renderUnits(c);
  }

  Object.values(civs).forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;select.appendChild(o)});
  select.addEventListener('change',()=>render(select.value));
  document.getElementById('toggleReference').onclick=()=>mat.classList.toggle('show-reference');
  document.getElementById('toggleGrid').onclick=()=>mat.classList.toggle('grid-guides');
  document.getElementById('printBtn').onclick=()=>window.print();
  render(select.value || Object.keys(civs)[0]);
})();
