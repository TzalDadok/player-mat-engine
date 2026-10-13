import { AoEGame } from './engine/game.js';

const CIVS = [
  ['britanicos','Britones'],
  ['francos','Francos'],
  ['vikingos','Vikingos'],
  ['persas','Persas']
];

const TERRAIN_ICON = {
  forest:'🌲', animals:'🐑', berries:'🫐', gold:'🪙', stone:'🪨',
  water:'🌊', desert:'🏜', mountain:'⛰', plain:'·'
};

const UNIT_SHORT = {
  villager:'A', fishingBoat:'P', transportShip:'T',
  militia:'M', archer:'Ar', skirmisher:'E', spearman:'Pi',
  rider:'J', knight:'C', longbow:'LB', elephant:'El',
  galley:'G', ram:'Ri', scorpion:'Es', trebuchet:'Tr',
  monk:'Mo', missionary:'Mi'
};

const BUILDING_SHORT = {
  mill:'Mol', camp:'Camp', port:'Pto', market:'Mer', farm:'Gra',
  barracks:'Cua', tower:'Tor', castle:'Cas', monastery:'Mon', siege:'As'
};

const AGE_NAME = {dark:'I · Alta Edad Media',feudal:'II · Feudal',castles:'III · Castillos',imperial:'IV · Imperial'};
const PHASE_NAME = {economy:'Economía',technology:'Tecnología',military:'Militar'};

const els = {
  setup:document.getElementById('setup'),
  game:document.getElementById('game'),
  playerCount:document.getElementById('playerCount'),
  playersSetup:document.getElementById('playersSetup'),
  seed:document.getElementById('seedInput'),
  start:document.getElementById('startBtn'),
  newGame:document.getElementById('newGameBtn'),
  board:document.getElementById('board'),
  active:document.getElementById('activePlayerLabel'),
  turn:document.getElementById('turnLabel'),
  playerStatus:document.getElementById('playerStatus'),
  selectedInfo:document.getElementById('selectedInfo'),
  unitSelection:document.getElementById('unitSelection'),
  actions:document.getElementById('actionPanel'),
  message:document.getElementById('actionMessage'),
  finishPhase:document.getElementById('finishPhaseBtn'),
  hand:document.getElementById('handPanel'),
  log:document.getElementById('gameLog'),
  winner:document.getElementById('winnerBanner'),
  export:document.getElementById('exportBtn')
};

let game = null;
let selectedHexId = null;
let selectedUnitIds = new Set();

const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[m]));

function renderSetup(){
  const n=Number(els.playerCount.value);
  const old=[...els.playersSetup.querySelectorAll('select')].map(x=>x.value);
  els.playersSetup.innerHTML='';
  for(let i=0;i<n;i++){
    const label=document.createElement('label');
    label.className='player-setup';
    label.innerHTML=`Jugador ${i+1}<select data-player="${i}">${CIVS.map(([id,name])=>
      `<option value="${id}" ${(old[i]||CIVS[i%CIVS.length][0])===id?'selected':''}>${name}</option>`
    ).join('')}</select>`;
    els.playersSetup.appendChild(label);
  }
}

function createGame(){
  const selects=[...els.playersSetup.querySelectorAll('select')];
  const players=selects.map((s,i)=>({
    id:`P${i+1}`,
    name:s.options[s.selectedIndex].text,
    civ:s.value
  }));
  game=AoEGame.createFFA({players,seed:els.seed.value.trim()||'aevum-playtest'});
  selectedHexId=game.activePlayer.tcHexId;
  selectedUnitIds.clear();
  els.setup.classList.add('hidden');
  els.game.classList.remove('hidden');
  setMessage('');
  render();
}

function hexCenter(hex,size=43){
  return {
    x:size*Math.sqrt(3)*(hex.q+hex.r/2),
    y:size*1.5*hex.r
  };
}

function hexPoints(cx,cy,size=40){
  return Array.from({length:6},(_,i)=>{
    const a=(Math.PI/180)*(30+i*60);
    return `${cx+size*Math.cos(a)},${cy+size*Math.sin(a)}`;
  }).join(' ');
}

function hexClass(h){
  if(h.special==='wonder')return'wonder';
  if(h.special==='tc')return'tc';
  if(h.terrain==='water')return'water';
  if(h.terrain==='mountain')return'mountain';
  if(h.terrain==='desert')return'desert';
  return h.category==='primary'?'primary':'secondary';
}

function hexMainLabel(h){
  if(h.special==='wonder')return'★';
  if(h.special==='tc')return`CU ${h.tcOwnerId||''}`;
  if(h.source)return TERRAIN_ICON[h.source]||h.source;
  return TERRAIN_ICON[h.terrain]||h.terrain;
}

function renderBoard(){
  const centers=game.state.hexes.map(h=>({h,...hexCenter(h)}));
  const xs=centers.map(x=>x.x), ys=centers.map(x=>x.y);
  const pad=65;
  const minX=Math.min(...xs)-pad,maxX=Math.max(...xs)+pad,minY=Math.min(...ys)-pad,maxY=Math.max(...ys)+pad;
  els.board.setAttribute('viewBox',`${minX} ${minY} ${maxX-minX} ${maxY-minY}`);

  els.board.innerHTML=centers.map(({h,x,y})=>{
    const units=game.state.units.filter(u=>u.hexId===h.id&&!u.embarkedIn);
    const buildings=game.state.buildings.filter(b=>b.hexId===h.id);
    const unitText=units.map(u=>`${u.ownerId}:${UNIT_SHORT[u.type]||u.type}`).join(' ');
    const buildingText=buildings.map(b=>`${b.ownerId}:${BUILDING_SHORT[b.type]||b.type}`).join(' ');
    const res=game.resourcesAt(h.id);
    const resText=[
      res.food?`🥩${res.food}`:'',
      res.wood?`🪵${res.wood}`:'',
      res.stone?`🪨${res.stone}`:'',
      res.gold?`🪙${res.gold}`:'',
      h.relics?`◆${h.relics}`:''
    ].filter(Boolean).join(' ');

    return `<g class="hex ${hexClass(h)} ${selectedHexId===h.id?'selected':''}" data-hex="${h.id}">
      <polygon points="${hexPoints(x,y)}"></polygon>
      <text x="${x}" y="${y-10}">${esc(hexMainLabel(h))}</text>
      <text class="tiny" x="${x}" y="${y+2}">${esc(h.id)} ${h.waterLane?esc(h.waterLane):''}</text>
      <text class="tiny" x="${x}" y="${y+13}">${esc(unitText.slice(0,28))}</text>
      <text class="tiny" x="${x}" y="${y+23}">${esc(buildingText.slice(0,28))}</text>
      <text class="tiny" x="${x}" y="${y+33}">${esc(resText.slice(0,34))}</text>
    </g>`;
  }).join('');

  els.board.querySelectorAll('[data-hex]').forEach(g=>{
    g.addEventListener('click',()=>{
      selectedHexId=g.dataset.hex;
      selectedUnitIds.clear();
      render();
    });
  });
}

function renderStatus(){
  const p=game.activePlayer;
  els.active.textContent=`${p.name} (${p.id})`;
  els.turn.textContent=`Ronda ${game.state.round} · ${PHASE_NAME[game.state.phase]}`;
  document.querySelectorAll('[data-phase]').forEach(x=>x.classList.toggle('active',x.dataset.phase===game.state.phase));

  const civ=game.civilizationState(p.id);
  const score=game.state.mode==='competitive'?game.competitiveScore(p.id):null;
  els.playerStatus.innerHTML=`
    <div class="kv">
      <span>Civilización</span><b>${esc(civ.name)}</b>
      <span>Edad</span><b>${esc(AGE_NAME[p.age])}</b>
      <span>Poder de Pelea</span><b>${p.militaryPower}/16</b>
      <span>Tecnologías</span><b>${p.technologies.length}</b>
      <span>Militares entrenados</span><b>${p.stats.militaryTrained}</b>
      <span>Aldeanos entrenados</span><b>${p.stats.villagersTrained}</b>
      ${score?`<span>Puntos</span><b>${score.points}</b><span>Estrellas</span><b>${score.stars}</b>`:''}
    </div>`;
  els.winner.textContent=game.state.winnerId?`Ganador: ${game.playerMap.get(game.state.winnerId)?.name||game.state.winnerId}`:'';
}

function renderSelected(){
  const h=game.hexMap.get(selectedHexId);
  if(!h){
    els.selectedInfo.innerHTML='<span class="muted">Seleccioná un hexágono.</span>';
    els.unitSelection.innerHTML='';
    return;
  }

  const res=game.resourcesAt(h.id);
  const units=game.state.units.filter(u=>u.hexId===h.id&&!u.embarkedIn);
  const buildings=game.state.buildings.filter(b=>b.hexId===h.id);
  const controller=game.controllerOf(h.id);

  els.selectedInfo.innerHTML=`
    <div class="kv">
      <span>ID</span><b>${esc(h.id)}</b>
      <span>Terreno</span><b>${esc(h.special||h.source||h.terrain)}</b>
      <span>Control</span><b>${esc(controller||'—')}</b>
      <span>Explorada</span><b>${h.explored?'Sí':'No'}</b>
    </div>
    <div class="resource-pills">
      <span class="pill">🥩 ${res.food}</span><span class="pill">🪵 ${res.wood}</span>
      <span class="pill">🪨 ${res.stone}</span><span class="pill">🪙 ${res.gold}</span>
      ${h.relics?`<span class="pill">◆ ${h.relics}</span>`:''}
    </div>
    <div><b>Edificios:</b> ${buildings.length?buildings.map(b=>`${esc(b.ownerId)} · ${esc(BUILDING_SHORT[b.type]||b.type)}`).join(', '):'<span class="muted">ninguno</span>'}</div>`;

  els.unitSelection.innerHTML=units.length?units.map(u=>`
    <label class="unit-row">
      <input type="checkbox" data-unit-id="${u.id}" ${selectedUnitIds.has(u.id)?'checked':''}>
      <span><b>${esc(u.ownerId)}</b> · ${esc(UNIT_SHORT[u.type]||u.type)} <span class="muted">(${esc(u.type)})</span>
      ${u.garrisonedIn?' · guarecido':''}${u.relics?` · ◆${u.relics}`:''}</span>
    </label>
  `).join(''):'<div class="muted" style="margin-top:8px">Sin unidades.</div>';

  els.unitSelection.querySelectorAll('[data-unit-id]').forEach(cb=>{
    cb.addEventListener('change',()=>{
      if(cb.checked)selectedUnitIds.add(cb.dataset.unitId);
      else selectedUnitIds.delete(cb.dataset.unitId);
    });
  });
}

function optionsHexes(){
  return game.state.hexes.map(h=>`<option value="${h.id}">${h.id} · ${esc(h.special||h.source||h.terrain)}</option>`).join('');
}

function ownVillagerOptions(){
  return game.state.units
    .filter(u=>u.ownerId===game.activePlayer.id&&u.type==='villager'&&!u.embarkedIn)
    .map(u=>`<option value="${u.id}">${u.id} · ${u.hexId}</option>`).join('');
}

function ownBuildingOptions(type=null){
  return game.state.buildings
    .filter(b=>b.ownerId===game.activePlayer.id&&(!type||b.type===type))
    .map(b=>`<option value="${b.id}">${b.type} · ${b.hexId}</option>`).join('');
}

function selectedOwnUnits(){
  return [...selectedUnitIds].filter(id=>game.state.units.some(u=>u.id===id&&u.ownerId===game.activePlayer.id));
}

function commonMoveUI(){
  return `<div class="action-title">MOVER</div>
    <div class="row">
      <label>Destino<select id="moveTarget">${optionsHexes()}</select></label>
      <button id="moveBtn">Mover seleccionadas</button>
    </div>`;
}

function buildUI(category){
  const available=game.availableBuildings(game.activePlayer.id).filter(b=>b.category===category);
  if(!available.length)return'';
  return `<div class="action-title">CONSTRUIR</div>
    <div class="row">
      <label>Edificio<select id="buildType">${available.map(b=>`<option value="${b.type}">${esc(b.name)}</option>`).join('')}</select></label>
      <label>Aldeano<select id="builderId">${ownVillagerOptions()}</select></label>
      <button id="buildBtn">Construir aquí</button>
    </div>`;
}

function trainUI(actionCategory){
  const available=game.availableUnits(game.activePlayer.id).filter(u=>
    (u.category==='economic'?'economy':'military')===actionCategory
  );
  if(!available.length)return'';
  return `<div class="action-title">ENTRENAR</div>
    <div class="row">
      <label>Unidad<select id="trainType">${available.map(u=>`<option value="${u.type}">${esc(u.name)}</option>`).join('')}</select></label>
      <label>Cantidad<input id="trainQty" type="number" min="1" max="6" value="1"></label>
      <label>Edificio<select id="trainBuilding"><option value="">Centro Urbano</option>${ownBuildingOptions()}</select></label>
      <button id="trainBtn">Entrenar</button>
    </div>`;
}

function wireCommonActions(){
  const move=document.getElementById('moveBtn');
  if(move)move.onclick=()=>runAction(()=>{
    const ids=selectedOwnUnits();
    return game.moveUnits(game.activePlayer.id,ids,document.getElementById('moveTarget').value);
  });

  const build=document.getElementById('buildBtn');
  if(build)build.onclick=()=>runAction(()=>game.build(
    game.activePlayer.id,
    document.getElementById('buildType').value,
    selectedHexId,
    document.getElementById('builderId').value
  ));

  const train=document.getElementById('trainBtn');
  if(train)train.onclick=()=>runAction(()=>{
    const type=document.getElementById('trainType').value;
    const qty=Math.max(1,Number(document.getElementById('trainQty').value||1));
    const buildingId=document.getElementById('trainBuilding').value||undefined;
    return game.trainUnits(game.activePlayer.id,Array.from({length:qty},()=>({type,buildingId})));
  });
}

function renderActions(){
  if(!game||game.state.winnerId){
    els.actions.innerHTML='<div class="muted">Partida finalizada.</div>';
    return;
  }
  const p=game.activePlayer;
  const phase=game.state.phase;

  if(game.state.actionUsed){
    els.actions.innerHTML='<div class="muted">La acción de esta fase ya fue usada. Cerrá la fase para continuar.</div>';
    return;
  }

  if(phase==='economy'){
    els.actions.innerHTML=`<div class="actions">
      <div class="row"><button id="produceBtn">Producir en seleccionado</button></div>
      ${commonMoveUI()}
      ${buildUI('economic')}
      ${trainUI('economy')}
    </div>`;
    document.getElementById('produceBtn').onclick=()=>runAction(()=>game.produce(p.id,[selectedHexId]));
    wireCommonActions();
    return;
  }

  if(phase==='technology'){
    const techs=game.availableTechnologies(p.id);
    els.actions.innerHTML=`<div class="actions">
      <div class="action-title">INVESTIGAR</div>
      <div class="row">
        <label>Tecnología<select id="techId">${techs.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
        <button id="researchBtn" ${techs.length?'':'disabled'}>Investigar</button>
      </div>
      <div class="action-title">AVANZAR DE EDAD</div>
      <div class="row"><button id="ageBtn" ${p.age==='imperial'?'disabled':''}>Avanzar</button></div>
      <div class="action-title">MODIFICAR TERRENO</div>
      <div class="row">
        <label>Acción<select id="terrainAction"><option value="irrigate">Irrigar</option><option value="fortify">Fortificar</option></select></label>
        <label>Hex adyacente<select id="terrainNeighbor">${optionsHexes()}</select></label>
        <button id="terrainBtn">Aplicar</button>
      </div>
    </div>`;

    document.getElementById('researchBtn').onclick=()=>runAction(()=>game.research(p.id,document.getElementById('techId').value));
    document.getElementById('ageBtn').onclick=()=>runAction(()=>game.advanceAge(p.id));
    document.getElementById('terrainBtn').onclick=()=>runAction(()=>{
      const action=document.getElementById('terrainAction').value;
      const neighbor=document.getElementById('terrainNeighbor').value;
      const extra=action==='fortify'?{neighborHexId:neighbor}:{};
      return game.modifyTerrain(p.id,action,selectedHexId,extra);
    });
    return;
  }

  els.actions.innerHTML=`<div class="actions">
    ${commonMoveUI()}
    ${buildUI('military')}
    ${trainUI('military')}
    <div class="action-title">INSTRUIR</div>
    <div class="row"><button id="instructBtn">+1 Poder de Pelea</button></div>
    <div class="action-title">ATACAR</div>
    <div class="row">
      <label>Objetivo<select id="attackTarget">${optionsHexes()}</select></label>
      <label>Apuesta propia<input id="attackerBid" type="number" min="0" max="8" value="0"></label>
      <label>Apuesta rival<input id="defenderBid" type="number" min="0" max="8" value="0"></label>
      <button id="attackBtn">Resolver combate</button>
    </div>
  </div>`;
  wireCommonActions();
  document.getElementById('instructBtn').onclick=()=>runAction(()=>game.instruct(p.id));
  document.getElementById('attackBtn').onclick=()=>runAction(()=>game.attack(p.id,{
    unitIds:selectedOwnUnits(),
    targetHexId:document.getElementById('attackTarget').value,
    attackerBid:Number(document.getElementById('attackerBid').value||0),
    defenderBid:Number(document.getElementById('defenderBid').value||0)
  }));
}

function renderHand(){
  const hand=game.explorationHand(game.activePlayer.id);
  if(!hand.length){
    els.hand.innerHTML='<span class="muted">Sin cartas en mano.</span>';
    return;
  }
  els.hand.innerHTML=hand.map(id=>`<span class="pill">${esc(id)}</span>`).join(' ') +
    '<div class="muted" style="margin-top:8px">Los efectos complejos están disponibles en el motor; esta interfaz muestra la mano para depuración.</div>';
}

function renderLog(){
  const rows=game.state.log.slice(-80).reverse();
  els.log.innerHTML=rows.map(x=>`
    <div class="log-line">
      <span class="n">#${x.n} · R${x.round}</span>
      <span class="type">${esc(x.type)}</span>
      <pre>${esc(JSON.stringify(x.data))}</pre>
    </div>`).join('');
}

function setMessage(text,error=false){
  els.message.textContent=text||'';
  els.message.classList.toggle('error',!!error);
}

function runAction(fn){
  try{
    const result=fn();
    setMessage(result===undefined?'Acción realizada.':'Acción realizada.');
    selectedUnitIds.clear();
    render();
  }catch(err){
    console.error(err);
    setMessage(err?.message||String(err),true);
  }
}

function render(){
  if(!game)return;
  renderStatus();
  renderBoard();
  renderSelected();
  renderActions();
  renderHand();
  renderLog();
  els.finishPhase.disabled=!!game.state.winnerId;
}

els.finishPhase.addEventListener('click',()=>{
  if(!game||game.state.winnerId)return;
  try{
    if(!game.state.actionUsed)game.pass(game.activePlayer.id);
    if(!game.state.winnerId)game.endPhase();
    selectedUnitIds.clear();
    selectedHexId=game.activePlayer?.tcHexId||selectedHexId;
    setMessage('');
    render();
  }catch(err){
    setMessage(err.message,true);
  }
});

els.export.addEventListener('click',()=>{
  if(!game)return;
  const blob=new Blob([JSON.stringify(game.snapshot(),null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`aevum-${game.state.mapMeta?.seed||'game'}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});

els.newGame.addEventListener('click',()=>{
  game=null;
  els.game.classList.add('hidden');
  els.setup.classList.remove('hidden');
});
els.start.addEventListener('click',createGame);
els.playerCount.addEventListener('change',renderSetup);

renderSetup();
