/* modelo de datos: casa → habitaciones (paredes, huecos, elementos fijos) → distribuciones → muebles
   Coordenadas en cm: x desde la pared izquierda, y desde la pared de arriba. */
const STORE='casa-v2', OLD_STORE='cuarto-bebe-v1';
const SIDES=['top','right','bottom','left'];
const SIDE_NAMES={top:'Arriba',right:'Derecha',bottom:'Abajo',left:'Izquierda'};
const DEFAULT_LABELS={top:'pared de arriba',right:'pared derecha',bottom:'pared de abajo',left:'pared izquierda'};
const STATUSES=[['idea','Idea'],['decidido','Decidido'],['comprado','Comprado'],['montado','Montado']];
const FIX={
  wardrobe:{label:'Armario empotrado',art:'el',len:100,depth:60,h:250,inset:true,clear:50,doors:2},
  radiator:{label:'Radiador',art:'el',len:80,depth:12,h:55,inset:false},
  column:{label:'Columna',art:'la',len:30,depth:10,h:250,inset:false},
  niche:{label:'Hueco en la pared',art:'el',len:80,depth:30,h:250,inset:true,soft:1},
  box:{label:'Elemento fijo',art:'el',len:60,depth:60,h:90,inset:false}
};
const OPEN={door:{label:'Puerta',width:76,height:205,frame:5,hinge:'start'},window:{label:'Ventana',width:100,height:120,sill:90}};

/* distribuciones iniciales del cuarto de la bebé */
const ci=(n,x,y,rot,extra)=>mk({...findCat(n),...(extra||{})},x,y,rot);
function actualItems(){return [
  ci('Escritorio MICKE',0,2,90),ci('Silla de escritorio',58,30),
  ci('Cama 90×190',183,10,0,{name:'Cama (actual)',w:92,d:195}),ci('Kallax 4×4',96,311),
  mk({name:'Cuadro grande',type:'picture',w:140,d:3,h:90,color:'rose',kind:'wall'},0,140,90)
]}
function exampleItems(){return [
  ci('Cómoda cambiador',0,2,90),ci('Cuna 60×120',0,100),
  ci('Cama 90×190',183,10,0,{name:'Cama (actual)',w:92,d:195}),ci('Kallax 4×4',96,311),
  mk({name:'Cuadro grande',type:'picture',w:140,d:3,h:90,color:'rose',kind:'wall'},0,140,90)
]}
function cunaEscritorioItems(){return [
  ci('Escritorio MICKE',0,0,90),ci('Silla de escritorio',55,35),ci('Piscina de bolas 88×52',223,15,90),
  ci('Cambiador IKEA SMÅSTAD',0,150,90),ci('Alfombra 120×170',85,120),ci('Cuna 60×120',209,150),ci('Kallax 4×4',96,311)
]}
const cunaEscritorio=()=>({id:'ce',name:'Cuna + Escritorio',items:cunaEscritorioItems()});

// medidas de la habitación tomadas de las fotos y de las medidas de la familia
const BABY0={W:275,L:350,winX:6,winW:106,radX:11.5,radW:95,radD:15,wardW:125,wardD:50,wardDoor:50,colW:32,colD:10,col2W:28,col2D:10,doorX:5,doorW:76,doorHinge:'left',H:250,winSill:90,winH:120};
function babyRoomFrom(o){
  const W=o.W,L=o.L;
  return {id:'r1',name:'Cuarto de la bebé',W,L,H:o.H||250,lamp:true,
    labels:{top:'pared de la ventana',right:'pared de la cama',bottom:'pared de la puerta',left:'pared del escritorio'},
    openings:[
      {id:'o1',type:'window',wall:'top',pos:o.winX,width:o.winW,sill:o.winSill||90,height:o.winH||120},
      {id:'o2',type:'door',wall:'bottom',pos:o.doorX,width:o.doorW,height:205,frame:5,hinge:o.doorHinge==='right'?'end':'start'}
    ],
    fixtures:[
      {id:'f1',type:'wardrobe',label:'Armario empotrado',wall:'top',pos:W-o.colW-o.wardW,len:o.wardW,depth:o.wardD,h:o.H||250,inset:true,clear:o.wardDoor,doors:2},
      {id:'f2',type:'column',label:'Columna del armario',wall:'top',pos:W-o.colW,len:o.colW,depth:o.colD,h:o.H||250,inset:false},
      {id:'f3',type:'radiator',label:'Radiador',wall:'top',pos:o.radX,len:o.radW,depth:o.radD,h:55,inset:true,rh:o.winSill||90},
      {id:'f4',type:'column',label:'Columna junto al Kallax',wall:'bottom',pos:W-o.col2W,len:o.col2W,depth:o.col2D,h:o.H||250,inset:false}
    ],
    layouts:[cunaEscritorio(),{id:'a',name:'Actual',items:actualItems()},{id:'b',name:'Ejemplo con cuna',items:exampleItems()}],
    active:'ce'};
}
function blankRoom(name,W,L){
  return {id:uid('r'),name,W,L,H:250,lamp:true,labels:{...DEFAULT_LABELS},
    openings:[{id:uid('o'),type:'door',wall:'bottom',pos:10,width:76,height:205,frame:5,hinge:'start'}],
    fixtures:[],layouts:[{id:uid('l'),name:'Distribución 1',items:[]}],active:null};
}
function seed(){return {v:4,rooms:[babyRoomFrom(BABY0)],roomId:'r1',snap:5,minPass:60,custom:[],wishlist:[],seeds:['ce']}}

function fixItems(items){items.forEach(i=>{if(!i.type)i.type=inferType(i.name,i.kind);if(i.locked===undefined)i.locked=false;if(!i.kind)i.kind='floor';if(!i.shape)i.shape='rect'})}
function upgrade(s){
  s.v=4;s.custom=s.custom||[];s.wishlist=s.wishlist||[];s.minPass=s.minPass||60;s.snap=s.snap||5;
  for(const r of s.rooms){r.labels=r.labels||{...DEFAULT_LABELS};r.openings=r.openings||[];r.fixtures=r.fixtures||[];r.layouts.forEach(l=>fixItems(l.items))}
  if(!s.rooms.some(r=>r.id===s.roomId))s.roomId=s.rooms[0].id;
  return s;
}
// datos de la versión 1 (una sola habitación con medidas fijas)
function fromV1(o){
  const r=o.room||{};
  if(r.H===undefined)Object.assign(r,{H:BABY0.H,winSill:BABY0.winSill,winH:BABY0.winH});
  if(r.col2W===undefined){
    Object.assign(r,{col2W:BABY0.col2W,col2D:BABY0.col2D,doorX:BABY0.doorX,doorW:BABY0.doorW});
    o.layouts.forEach(l=>l.items.forEach(i=>{if(i.name==='Kallax 4×4'&&i.x===126&&i.y===311)i.x=96}));
  }
  if(!(r.v>=3)){
    Object.assign(r,{radX:BABY0.radX,radW:BABY0.radW,radD:BABY0.radD,wardD:BABY0.wardD,wardDoor:BABY0.wardDoor,colD:BABY0.colD,col2D:BABY0.col2D});
    o.layouts.forEach(l=>l.items.forEach(i=>{if(i.name==='Cama (actual)'&&i.y===62)i.y=10}));
  }
  const room=babyRoomFrom({...BABY0,...r});
  o.layouts.forEach(l=>fixItems(l.items));
  room.layouts=o.layouts;
  if(!(o.seeds||[]).includes('ce')&&!room.layouts.some(l=>l.name==='Cuna + Escritorio'))room.layouts.unshift(cunaEscritorio());
  room.active=room.layouts.some(l=>l.id===o.active)?o.active:room.layouts[0].id;
  return {v:4,rooms:[room],roomId:'r1',snap:o.snap||5,minPass:60,custom:[],wishlist:[],seeds:['ce']};
}
function load(){
  try{const s=JSON.parse(localStorage.getItem(STORE));if(s&&s.rooms&&s.rooms.length)return upgrade(s)}catch(e){}
  try{const o=JSON.parse(localStorage.getItem(OLD_STORE));if(o&&o.layouts&&o.layouts.length)return fromV1(o)}catch(e){}
  return null;
}
function save(){try{localStorage.setItem(STORE,JSON.stringify(S))}catch(e){}}

let S=null;
const room=()=>S.rooms.find(r=>r.id===S.roomId)||S.rooms[0];
const cur=()=>{const R=room();return R.layouts.find(l=>l.id===R.active)||R.layouts[0]};

/* geometría */
const wallLen=(R,s)=>s==='top'||s==='bottom'?R.W:R.L;
// rectángulo a partir de un tramo de pared: a0..a1 a lo largo de ella, o0..o1 hacia fuera (0 = cara interior, negativo = dentro)
function wrect(R,side,a0,a1,o0,o1){
  switch(side){
    case 'top':return{x:a0,y:-o1,w:a1-a0,d:o1-o0};
    case 'bottom':return{x:a0,y:R.L+o0,w:a1-a0,d:o1-o0};
    case 'left':return{x:-o1,y:a0,w:o1-o0,d:a1-a0};
    default:return{x:R.W+o0,y:a0,w:o1-o0,d:a1-a0};
  }
}
function wpt(R,side,a,o){return side==='top'?{x:a,y:-o}:side==='bottom'?{x:a,y:R.L+o}:side==='left'?{x:-o,y:a}:{x:R.W+o,y:a}}
function fixRect(R,f){
  if(!f.wall)return{x:f.x,y:f.y,w:f.len,d:f.depth};
  return f.inset?wrect(R,f.wall,f.pos,f.pos+f.len,0,f.depth):wrect(R,f.wall,f.pos,f.pos+f.len,-f.depth,0);
}
function fixClear(R,f){
  if(!(f.clear>0)||!f.wall)return null;
  return f.inset?wrect(R,f.wall,f.pos,f.pos+f.len,-f.clear,0):wrect(R,f.wall,f.pos,f.pos+f.len,-f.depth-f.clear,-f.depth);
}
const fxMeta=f=>FIX[f.type]||FIX.box;
const fxLabel=f=>f.label||fxMeta(f).label;
const fxName=f=>(fxMeta(f).art==='la'?'la ':'el ')+lc1(fxLabel(f));
const fxDe=f=>(fxMeta(f).art==='la'?'de la ':'del ')+lc1(fxLabel(f));
const opLabel=o=>OPEN[o.type].label;
// profundidad del hueco bajo una ventana (radiador empotrado), para dibujar el cristal detrás
function winDepth(R,o){let d=0;for(const f of R.fixtures)if(f.wall===o.wall&&f.inset&&f.rh&&f.rh<(R.H||250)&&f.pos<o.pos+o.width&&f.pos+f.len>o.pos)d=Math.max(d,f.depth);return d}
function doorGeo(R,o){const a=o.hinge==='end'?o.pos+o.width:o.pos;return{P:wpt(R,o.wall,a,0),R:o.width,q:wrect(R,o.wall,o.pos,o.pos+o.width,-o.width,0)}}

function fp(it){return it.rot%180?{x:it.x,y:it.y,w:it.d,d:it.w}:{x:it.x,y:it.y,w:it.w,d:it.d}}
function clampItem(it,R){R=R||room();const f=fp(it);it.x=Math.min(Math.max(0,it.x),Math.max(0,R.W-f.w));it.y=Math.min(Math.max(0,it.y),Math.max(0,R.L-f.d))}
function overlap(a,b){return a.x<b.x+b.w-.01&&b.x<a.x+a.w-.01&&a.y<b.y+b.d-.01&&b.y<a.y+a.d-.01}
function inter(a,b){const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),x2=Math.min(a.x+a.w,b.x+b.w),y2=Math.min(a.y+a.d,b.y+b.d);return x2>x&&y2>y?{x,y,w:x2-x,d:y2-y}:null}
function rdist(a,b){const dx=Math.max(0,b.x-(a.x+a.w),a.x-(b.x+b.w)),dy=Math.max(0,b.y-(a.y+a.d),a.y-(b.y+b.d));return Math.hypot(dx,dy)}
function hitsDoor(f,g){const I=inter(f,g.q);if(!I)return false;const cx=Math.min(Math.max(g.P.x,I.x),I.x+I.w),cy=Math.min(Math.max(g.P.y,I.y),I.y+I.d);return Math.hypot(cx-g.P.x,cy-g.P.y)<g.R-.5}
function clampFixture(f,R){
  if(!f.wall){f.x=Math.min(Math.max(0,f.x),Math.max(0,R.W-f.len));f.y=Math.min(Math.max(0,f.y),Math.max(0,R.L-f.depth));return}
  f.pos=Math.min(Math.max(0,f.pos),Math.max(0,wallLen(R,f.wall)-f.len));
}
function clampOpening(o,R){const fr=o.type==='door'?(o.frame||0):0;o.pos=Math.min(Math.max(fr,o.pos),Math.max(fr,wallLen(R,o.wall)-o.width-fr))}

/* deshacer */
let undoStack=[];
function pushUndo(snap){undoStack.push(snap||JSON.stringify(S));if(undoStack.length>60)undoStack.shift()}
function mutate(fn,opts){pushUndo();fn();save();renderAll(opts)}
