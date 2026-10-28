import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const port=8795;
const root='http://127.0.0.1:'+port;
const room='UI-'+randomUUID().slice(0,9);
const runner=spawn(process.execPath,['./node_modules/wrangler/bin/wrangler.js','dev','--local','--port',String(port),'--ip','127.0.0.1'],{
  cwd:process.cwd(),env:{...process.env,NO_COLOR:'1',CI:'1'},stdio:['ignore','pipe','pipe']
});
let log='';
for(const stream of [runner.stdout,runner.stderr])stream.on('data',chunk=>{log=(log+String(chunk)).slice(-10000)});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function poll(fn,message,timeout=25000){
  const start=Date.now();
  while(Date.now()-start<timeout){
    const result=await fn();
    if(result)return result;
    await sleep(90);
  }
  throw Error('Timeout '+message+'\n'+log);
}
const dirs=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const distance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
function candidate(map){
  const used=new Set([...map.hexes,{q:0,r:0}].map(p=>p.q+','+p.r));
  const positions=new Map();
  for(const h of map.hexes)for(const [dq,dr] of dirs){
    const p={q:h.q+dq,r:h.r+dr};if(!used.has(p.q+','+p.r))positions.set(p.q+','+p.r,p);
  }
  const valid=[...positions.values()].filter(p=>
    (map.centers??[]).every(c=>distance(c,p)>1)&&
    map.hexes.some(h=>distance(h,p)===1&&!h.type.startsWith('Agua')));
  assert(valid.length>0,'Sin casillas para CU');
  return {point:valid[0],spots:valid};
}
async function pixel(page,map,point,seat){
  const canvas=page.locator('.stage canvas');
  await canvas.scrollIntoViewIfNeeded();
  const rect=await canvas.boundingBox();
  const size=await canvas.evaluate(el=>({w:el.width,h:el.height}));
  assert(rect,'Canvas no visible');
  const display=[...map.hexes,{q:0,r:0}],centers=map.centers??[];
  const placing=map.started&&centers.length<map.count&&map.order[centers.length]===seat;
  const spots=placing?candidate(map).spots:[];
  const shown=[...display,...centers,...(map.draft?[map.draft]:[]),...spots];
  const screen=shown.map(p=>({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r}));
  const minX=Math.min(...screen.map(p=>p.x)),maxX=Math.max(...screen.map(p=>p.x));
  const minY=Math.min(...screen.map(p=>p.y)),maxY=Math.max(...screen.map(p=>p.y));
  const margin=Math.min(22,Math.max(8,Math.min(size.w,size.h)*.035)),topReserve=38;
  const scale=Math.max(1,Math.min((size.w-2*margin)/(maxX-minX+2),(size.h-topReserve-2*margin)/(maxY-minY+2)));
  const cx=size.w/2-scale*(minX+maxX)/2,cy=(size.h+topReserve)/2-scale*(minY+maxY)/2;
  return {x:rect.x+(cx+scale*Math.sqrt(3)*(point.q+point.r/2))*rect.width/size.w,
    y:rect.y+(cy+scale*1.5*point.r)*rect.height/size.h};
}
function observe(page){
  const frames=[];
  page.on('websocket',socket=>socket.on('framereceived',frame=>{
    try{const data=JSON.parse(String(frame.payload));if(data.type==='map')frames.push(data.map)}catch{}
  }));
  return {frames,latest:()=>frames[frames.length-1]};
}
let browser;
try{
  await poll(async()=>{try{return (await fetch(root+'/api/health')).ok}catch{return false}},'Worker local');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const desktop=await browser.newPage({viewport:{width:1365,height:900}});
  const mobileCtx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const mobile=await mobileCtx.newPage();
  const host=observe(desktop),guest=observe(mobile);
  const url=root+'/?sala='+room;
  await desktop.goto(url);await mobile.goto(url);
  await desktop.locator('#name').fill('Anfitrión');
  await desktop.locator('#join').click();
  await poll(()=>host.frames.length>0,'bienvenida anfitrión');
  await desktop.locator('#count').selectOption('2');
  await desktop.locator('#generate').click();
  await poll(()=>host.latest()?.count===2,'mapa generado');
  await mobile.locator('#name').fill('Invitado móvil');
  await mobile.locator('#join').click();
  await poll(()=>guest.latest()?.count===2,'mapa sincronizado móvil');
  await desktop.waitForSelector('#lobby-panel:not([hidden])');
  await mobile.waitForSelector('#lobby-panel:not([hidden])');
  const rows='#lobby-rows tr';
  await desktop.locator(rows).nth(0).locator('select').first().selectOption('0');
  await poll(()=>host.latest()?.civs?.[0]===0,'civilización anfitrión');
  await mobile.locator(rows).nth(1).locator('select').first().selectOption('1');
  await poll(()=>host.latest()?.civs?.[1]===1,'civilización móvil');
  const withinPanel=await mobile.evaluate(()=>{
    const table=document.querySelector('.lobby-scroll');
    return table.scrollWidth<=table.clientWidth+1;
  });
  assert(withinPanel,'La tabla móvil necesita scroll horizontal');
  await desktop.locator(rows).nth(0).locator('input[type=checkbox]').check();
  await mobile.locator(rows).nth(1).locator('input[type=checkbox]').check();
  await poll(()=>host.latest()?.ready?.[0]===true&&host.latest()?.ready?.[1]===true,'ambos Ready');
  await desktop.locator('#start-game').click();
  await poll(()=>host.latest()?.started===true,'inicio de partida');
  const first=candidate(host.latest()).point;
  const firstXY=await pixel(desktop,host.latest(),first,0);
  await desktop.mouse.click(firstXY.x,firstXY.y);
  await desktop.waitForSelector('#confirm-cu:not([hidden])');
  await desktop.locator('#confirm-cu').click();
  await poll(()=>guest.latest()?.centers?.length===1,'CU anfitrión confirmado');
  const second=candidate(guest.latest()).point;
  const secondXY=await pixel(mobile,guest.latest(),second,1);
  await mobile.touchscreen.tap(secondXY.x,secondXY.y);
  await mobile.waitForSelector('#confirm-cu:not([hidden])');
  await mobile.locator('#confirm-cu').click();
  await poll(()=>host.latest()?.match?.units?.length>0,'partida inicializada');
  await desktop.waitForSelector('#playing-panel:not([hidden])');
  await mobile.waitForSelector('#playing-panel:not([hidden])');
  assert((await desktop.locator('#turn-status').textContent()).includes('Ronda 1'));
  assert((await mobile.locator('#turn-status').textContent()).includes('Ronda 1'));
  await desktop.locator('#action-pass').click();
  await desktop.waitForFunction(()=>document.querySelector('#turn-status')?.textContent?.includes('Tecnológica'));
  await desktop.locator('#action-pass').click();
  await desktop.waitForFunction(()=>document.querySelector('#turn-status')?.textContent?.includes('Militar'));
  await desktop.locator('#action-pass').click();
  await poll(()=>guest.latest()?.match?.turn===1,'turno móvil');
  await mobile.locator('#action-move').click();
  await mobile.locator('#unit-list button').first().click();
  const units=guest.latest().match.units.filter(u=>u.seat===1);
  assert(units.length,'El invitado no recibió aldeanos');
  const from=units[0];
  const target=guest.latest().hexes.find(h=>distance(h,from)===1&&!h.type.startsWith('Agua')&&
    !guest.latest().match.units.some(u=>u.seat!==1&&u.q===h.q&&u.r===h.r));
  assert(target,'No hay destino caminable para la prueba táctil');
  const walk=await pixel(mobile,guest.latest(),target,1);
  await mobile.touchscreen.tap(walk.x,walk.y);
  assert((await mobile.locator('#selected-hexes').textContent()).includes('('+target.q+','+target.r+')'),'Toque no seleccionó destino');
  await mobile.locator('#submit-action').click();
  await poll(()=>guest.latest()?.match?.turn===1&&guest.latest()?.match?.phase===1,'movimiento táctil');
  console.log('OK: escritorio + móvil, lobby, Ready, CU táctil, HUD y movimiento');
}catch(error){
  console.error(error);
  console.error(log);
  process.exitCode=1;
}finally{
  if(browser)await browser.close().catch(()=>{});
  runner.kill('SIGTERM');
  setTimeout(()=>process.exit(process.exitCode??0),1500).unref();
}
