import {AoEGame} from '../engine/game.js';
import {physicalNeighbors} from '../engine/hex.js';
import {BaselineBot} from '../bots/baseline.js';

const game=AoEGame.createFFA({players:[
{id:'P1',name:'British',civ:'britanicos'},
{id:'P2',name:'Franks',civ:'francos'},
{id:'P3',name:'Vikings',civ:'vikingos'},
{id:'P4',name:'Persians',civ:'persas'}],seed:'network-only-contract',mapPreset:'ffa60'});
game.state.logisticsNetworkEnabled=true;
game.state.autoProductionEnabled=false;
const tc=game.playerMap.get('P1').tcHexId;
const adjacent=physicalNeighbors(game.state.hexes,tc).filter(h=>h.terrain!=='water');
if(adjacent.length<2)throw Error('Need two adjacent land tiles');
const [site,store]=adjacent;
site.terrain='plain';site.source=null;site.special=null;
store.terrain='forest';store.source='forest';store.special=null;
game.addUnit('P1','villager',site.id);
game.addUnit('P1','villager',store.id);
game.addResourceTokens(store.id,{wood:1,stone:3,gold:2,food:1});
const bot=new BaselineBot({playerId:'P1',seed:'contract'});
game.state.phase='military';game.state.actionUsed=false;
const beforeSite=game.resourcesAt(site.id);
const beforeRemote=game.resourcesAt(store.id);
if(Object.values(beforeSite).some(Boolean))throw Error('Build tile unexpectedly holds resources');
const built=bot.tryBuildBarracks(game);
if(!built.ok)throw Error('Bot failed connected remote-payment barracks: '+built.error?.message);
if((game.resourcesAt(store.id).stone||0)!==0)throw Error('Remote stone was not spent');
game.state.phase='military';game.state.actionUsed=false;
const trained=bot.tryTrainMilitary(game);
if(!trained.ok)throw Error('Bot failed connected remote-payment military training: '+trained.error?.message);
const types=game.state.log.filter(e=>['load','unload'].includes(e.type));
if(types.length)throw Error('Bot transported connected resources');
console.log(JSON.stringify({pass:true,site:site.id,remoteStore:store.id,
 constructed:built.label,trained:trained.label,transportActions:types.length,
 beforeRemote,afterRemote:game.resourcesAt(store.id)}));
