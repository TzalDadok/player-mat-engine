(() => {
  const civs = window.PLAYER_MAT_CIVS || {};
  const mat = document.getElementById('mat');
  const hero = document.getElementById('hero');
  const sidebar = document.getElementById('sidebar');
  const tree = document.getElementById('tree');
  const select = document.getElementById('civSelect');

  const R = {food:'🥩', wood:'🪵', stone:'🪨', gold:'🪙'};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const costHTML = cost => {
    if (!cost) return '';
    return `<div class="costline">${Object.entries(cost).filter(([,v])=>v!==undefined).map(([k,v])=>`<span class="cost-item"><span class="ri">${R[k]||k}</span>${esc(v)}</span>`).join('')}</div>`;
  };
  const statsHTML = s => s ? `<div class="stats"><span class="force">${s.force}</span><span class="range">${s.range}</span><span class="move">${s.move}</span></div>` : '';

  function renderSidebar(c){
    const action = (num, cls, title, rows) => `<section class="action ${cls}"><div class="action-head"><span class="action-num">${num}</span><span>${title}</span><small>Elegí 1 acción</small></div><div class="action-body">${rows.map(([a,b])=>`<div class="action-row"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</div></section>`;
    sidebar.innerHTML = `<div class="sidebar-title"><b>TU TURNO</b><small>Realizá 1 acción de cada tipo, en orden.</small></div>
      ${action(1,'econ','ECONOMÍA',c.turn.economy)}
      ${action(2,'tech','TECNOLOGÍA',c.turn.technology)}
      ${action(3,'mil','MILITAR',c.turn.military)}`;
  }

  function nodeHTML(n){
    return `<div class="node ${n.type}">${n.tag?`<div class="node-tag">${esc(n.tag)}</div>`:''}<div class="node-title">${esc(n.title)}</div>${statsHTML(n.stats)}${costHTML(n.cost)}${n.text?`<div class="node-text">${esc(n.text)}</div>`:''}</div>`;
  }

  function renderTree(c){
    tree.innerHTML = '';
    const corner = document.createElement('div'); corner.className='cell corner'; corner.innerHTML='<div class="label">EDIFICIOS</div>'; tree.appendChild(corner);
    c.buildings.forEach((b,i)=>{
      const d=document.createElement('div'); d.className='cell building-head'+(b.unlock?' locked':''); d.style.gridColumn=String(i+2); d.style.gridRow='1';
      d.innerHTML=`<div class="name">${esc(b.name)}</div><img src="${esc(b.image)}" alt="">`; tree.appendChild(d);
    });
    c.ages.forEach((a,ai)=>{
      const ac=document.createElement('div'); ac.className='cell age-cell'; ac.style.gridColumn='1'; ac.style.gridRow=String(ai+2);
      ac.innerHTML=`<div class="age-name"><span class="roman">${a.roman}</span><span class="text">${esc(a.name)}</span></div>`; tree.appendChild(ac);
      c.buildings.forEach((b,bi)=>{
        const slot=document.createElement('div'); slot.className='cell slot'; slot.dataset.age=a.id; slot.dataset.building=b.id; slot.style.gridColumn=String(bi+2); slot.style.gridRow=String(ai+2);
        const nodes=c.nodes.filter(n=>n.age===a.id&&n.building===b.id); slot.innerHTML=nodes.length?nodes.map(nodeHTML).join(''):'<div class="empty"></div>';
        tree.appendChild(slot);
      });
    });
    // visual flow arrows for columns with content across ages
    [...tree.querySelectorAll('.slot')].forEach(slot=>{
      const ageIndex=c.ages.findIndex(a=>a.id===slot.dataset.age);
      if(ageIndex<c.ages.length-1 && c.nodes.some(n=>n.building===slot.dataset.building && c.ages.findIndex(a=>a.id===n.age)>ageIndex)){
        const f=document.createElement('i'); f.className='flow'; slot.appendChild(f);
      }
    });
  }

  function render(id){
    const c=civs[id]; if(!c) return;
    // Physical player-mat size: fixed 14 cm height; width grows with the tech tree.
    const sidebarCm = 6.2;
    const ageCm = 3.2;
    const buildingCm = 3.3;
    mat.style.width = `${sidebarCm + ageCm + (c.buildings.length * buildingCm)}cm`;
    mat.style.height = '14cm';
    mat.style.setProperty('--sidebar-w', `${sidebarCm}cm`);
    tree.style.gridTemplateColumns = `${ageCm}cm repeat(${c.buildings.length}, ${buildingCm}cm)`;
    hero.classList.toggle('use-art', !!c.headerImage);
    hero.style.backgroundImage = c.headerImage ? `url('${c.headerImage}')` : '';
    hero.innerHTML=`<div class="flag">${c.flag}</div><div class="hero-title">${esc(c.name)}</div><div class="hero-subtitle">${esc(c.subtitle)}</div><div class="hero-motto">${esc(c.motto)}</div>`;
    renderSidebar(c); renderTree(c);
  }

  Object.values(civs).forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;select.appendChild(o)});
  select.addEventListener('change',()=>render(select.value));
  document.getElementById('toggleReference').onclick=()=>mat.classList.toggle('show-reference');
  document.getElementById('toggleGrid').onclick=()=>mat.classList.toggle('grid-guides');
  document.getElementById('printBtn').onclick=()=>window.print();
  render(select.value || Object.keys(civs)[0]);
})();
