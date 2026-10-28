import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const snapshot=JSON.parse(readFileSync(new URL('../worker/src/mats.generated.json',import.meta.url),'utf8'));
for(const [name,expected] of Object.entries(snapshot)){
  const source=readFileSync(new URL('../../player-mat-engine-v1/civs/'+name+'.js',import.meta.url),'utf8');
  const scope={window:{}};vm.runInNewContext(source,scope,{timeout:1000});
  const mat=Object.values(scope.window.PLAYER_MAT_CIVS)[0];
  const simplify=c=>Object.fromEntries(Object.entries(c??{}).map(([k,v])=>[k,Number(v)]));
  for(const b of expected.buildings){
    const original=mat.buildings.find(v=>v.name===b.name);
    assert(original,'Edificio faltante del Mat '+name+': '+b.name);
    assert.deepEqual(simplify(original.cost),b.cost,'Costo de edificio desactualizado: '+name+'/'+b.name);
  }
  for(const n of expected.nodes){
    const original=mat.nodes.find(v=>v.title===n.title&&v.age===n.age&&v.building===n.building&&v.type===n.type);
    assert(original,'Nodo faltante del Mat '+name+': '+n.title);
    assert.deepEqual(simplify(original.cost),n.cost,'Costo de nodo desactualizado: '+name+'/'+n.title);
  }
}
console.log('OK: datos del motor sincronizados con los cuatro Player Mats');
