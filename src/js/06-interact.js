/* acciones y manejo del puntero, teclado y barra del móvil */
function select(id){selId=id;renderAll()}
function selectFx(k,id){selFx=id?{k,id}:null;renderAll()}

function place(spec,extra){
  const it=mk({...spec,...(extra||{})},0,0),R=room(),f=fp(it);
  const bl=[...cur().items.filter(i=>i.kind==='floor').map(fp),...blockers(R)];
  const doors=R.openings.filter(o=>o.type==='door').map(o=>doorGeo(R,o));
  let best=null;
  if(it.kind==='floor'){
    outer:for(let y=0;y<=R.L-f.d;y+=5)for(let x=0;x<=R.W-f.w;x+=5){const c={x,y,w:f.w,d:f.d};if(!bl.some(b=>overlap(c,b))&&!doors.some(g=>hitsDoor(c,g))){best=c;break outer}}
  }
  if(best){it.x=best.x;it.y=best.y}else{it.x=Math.round(R.W/2-f.w/2);it.y=Math.round(R.L/2-f.d/2)}
  clampItem(it,R);
  mutate(()=>{cur().items.push(it);selId=it.id});
  if(isPhone()){sheet(false);$('#plan').scrollIntoView({block:'center'})}
  return it;
}
function rotateSel(){const it=selItem();if(!it||it.locked)return;mutate(()=>{const f=fp(it),cx=f.x+f.w/2,cy=f.y+f.d/2;it.rot=it.rot?0:90;const n=fp(it);it.x=Math.round(cx-n.w/2);it.y=Math.round(cy-n.d/2);clampItem(it)})}
function dupSel(){const it=selItem();if(!it)return;const c={...clone(it),id:uid(),x:it.x+10,y:it.y+10,locked:false};delete c.wid;mutate(()=>{clampItem(c);cur().items.push(c);selId=c.id})}
function removeSel(){if(!selItem())return;mutate(()=>{cur().items=cur().items.filter(i=>i.id!==selId);selId=null})}
function lockSel(){const it=selItem();if(it)mutate(()=>{it.locked=!it.locked})}
function syncXY(it){const fx=$('#f-x');if(fx&&it){fx.value=r1(it.x);$('#f-y').value=r1(it.y)}}
function nudge(dx,dy){
  if(mode==='room'){
    const R=room(),f=selFixture(),o=selOpening(),x=f||o;if(!x)return;
    mutate(()=>{if(x.wall){x.pos+=(x.wall==='top'||x.wall==='bottom')?dx:dy}else{x.x+=dx;x.y+=dy}f?clampFixture(f,R):clampOpening(o,R)});
    return;
  }
  const it=selItem();if(!it||it.locked)return;
  mutate(()=>{it.x+=dx;it.y+=dy;clampItem(it)},{keepInspector:1});syncXY(it);
}
function newRoom(name,W,L){
  mutate(()=>{const r=blankRoom(name,W,L);r.active=r.layouts[0].id;S.rooms.push(r);S.roomId=r.id;selId=null;selFx=null;mode='room'});
  Z={k:1,cx:null,cy:null};renderCatalog();renderAll();sheet(false);
}
function addFixture(k){
  const R=room();
  mutate(()=>{
    if(OPEN[k]){
      const d=OPEN[k],wall=k==='door'?'bottom':'top',o={id:uid('o'),type:k,wall,pos:0,...Object.fromEntries(Object.entries(d).filter(([x])=>x!=='label'))};
      o.pos=Math.round((wallLen(R,wall)-o.width)/2);clampOpening(o,R);R.openings.push(o);selFx={k:'op',id:o.id};
    }else{
      const m=FIX[k],f={id:uid('f'),type:k,label:m.label,len:m.len,depth:m.depth,h:m.h===250?R.H:m.h,inset:!!m.inset,clear:m.clear||0};
      if(m.doors)f.doors=m.doors;
      if(k==='box'){f.wall='';f.x=Math.round(R.W/2-f.len/2);f.y=Math.round(R.L/2-f.depth/2)}
      else{f.wall=k==='wardrobe'?'right':'top';f.pos=k==='column'?wallLen(R,f.wall)-f.len:Math.round((wallLen(R,f.wall)-f.len)/2)}
      clampFixture(f,R);R.fixtures.push(f);selFx={k:'fx',id:f.id};
    }
  });
  sheet(false);
}
function setMode(m){
  if(m===mode)return;
  mode=m;selId=null;selFx=null;
  if(m==='room'&&view!=='2d')setView('2d');
  renderCatalog();renderAll();
}
function sheet(open){document.body.classList.toggle('sheet',open)}
function undo(){const s=undoStack.pop();if(!s)return;S=JSON.parse(s);if(!selItem())selId=null;if(selFx&&!selFixture()&&!selOpening())selFx=null;save();renderCatalog();renderAll()}

/* puntero en el plano: arrastrar muebles o elementos, desplazar y pellizcar */
let drag=null,pan=null;
const ptrs=new Map();
function pt(e){const svg=$('#plan');return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse())}
function along(side,p){return side==='top'||side==='bottom'?p.x:p.y}
function onDown(e){
  const svg=$('#plan');
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  try{svg.setPointerCapture(e.pointerId)}catch(err){}
  if(ptrs.size===2){ // pellizco: se cancela el arrastre en curso
    if(drag&&drag.moved){pushUndo(drag.snap);save()}
    drag=null;const[a,b]=[...ptrs.values()];
    pan={pinch:true,d0:Math.hypot(a.x-b.x,a.y-b.y),k0:Z.k};return;
  }
  const p=pt(e);
  if(mode==='room'){
    const g=e.target.closest('[data-fx],[data-op]');
    if(g){
      const R=room(),isF=!!g.dataset.fx,x=isF?R.fixtures.find(f=>f.id===g.dataset.fx):R.openings.find(o=>o.id===g.dataset.op);
      if(!x)return;
      if(!selFx||selFx.id!==x.id)selectFx(isF?'fx':'op',x.id);
      drag={x,isF,snap:JSON.stringify(S),moved:false,off:x.wall?along(x.wall,p)-x.pos:null,ox:x.wall?0:p.x-x.x,oy:x.wall?0:p.y-x.y};
      svg.classList.add('dragging');e.preventDefault();return;
    }
  }else{
    const g=e.target.closest('[data-id]');
    if(g){
      const it=cur().items.find(i=>i.id===g.dataset.id);
      if(selId!==it.id)select(it.id);
      if(!it.locked){drag={id:it.id,ox:p.x-it.x,oy:p.y-it.y,snap:JSON.stringify(S),moved:false};svg.classList.add('dragging')}
      e.preventDefault();return;
    }
  }
  pan={x:e.clientX,y:e.clientY,cx:Z.cx,cy:Z.cy,moved:false};
}
function onMove(e){
  if(!ptrs.has(e.pointerId))return;
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pan&&pan.pinch&&ptrs.size===2){
    const[a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y);
    const mid=pt({clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2});
    zoomBy(pan.k0*d/pan.d0/Z.k,mid.x,mid.y);return;
  }
  if(pan&&!pan.pinch){
    if(Math.hypot(e.clientX-pan.x,e.clientY-pan.y)>4)pan.moved=true;
    if(Z.k>1&&pan.moved){
      const svg=$('#plan'),s=(base.w/Z.k)/svg.getBoundingClientRect().width;
      Z.cx=pan.cx-(e.clientX-pan.x)*s;Z.cy=pan.cy-(e.clientY-pan.y)*s;applyZoom();
    }
    return;
  }
  if(!drag)return;
  const p=pt(e),sn=S.snap||1,R=room();
  if(drag.x){
    const x=drag.x;
    if(x.wall){const np=Math.round((along(x.wall,p)-drag.off)/sn)*sn;if(np===x.pos)return;x.pos=np}
    else{const nx=Math.round((p.x-drag.ox)/sn)*sn,ny=Math.round((p.y-drag.oy)/sn)*sn;if(nx===x.x&&ny===x.y)return;x.x=nx;x.y=ny}
    drag.isF?clampFixture(x,R):clampOpening(x,R);drag.moved=true;render();return;
  }
  const it=cur().items.find(i=>i.id===drag.id);if(!it)return;
  const nx=Math.round((p.x-drag.ox)/sn)*sn,ny=Math.round((p.y-drag.oy)/sn)*sn;
  if(nx===it.x&&ny===it.y)return;
  it.x=nx;it.y=ny;clampItem(it);drag.moved=true;
  renderStatus(render());syncXY(it);
}
function onUp(e){
  ptrs.delete(e.pointerId);
  $('#plan').classList.remove('dragging');
  if(drag){const d=drag;drag=null;if(d.moved){pushUndo(d.snap);save();renderAll({keepInspector:!d.x})}return}
  if(pan){
    const tap=!pan.pinch&&!pan.moved;
    if(ptrs.size===0)pan=null;
    if(tap){if(mode==='room'){if(selFx)selectFx(null)}else if(selId)select(null)}
  }
}

function onKey(e){
  const tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='select'||tag==='textarea')return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return}
  if(view==='list')return;
  const st=e.shiftKey?10:1,mv={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,-st],ArrowDown:[0,st]}[e.key];
  if(mode==='room'){
    if(!selFx)return;
    if(mv){e.preventDefault();nudge(mv[0],mv[1])}
    else if(e.key==='Escape')selectFx(null);
    return;
  }
  const it=selItem();if(!it)return;
  if(mv){e.preventDefault();nudge(mv[0],mv[1])}
  else if(e.key==='r'||e.key==='R'){e.preventDefault();rotateSel()}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeSel()}
  else if(e.key==='l'||e.key==='L'){e.preventDefault();lockSel()}
  else if(e.key==='Escape')select(null);
}

function onMbar(e){
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;
  const room_=mode==='room';
  const acts={add:()=>sheet(true),undo,rot:rotateSel,dup:dupSel,lock:lockSel,
    desel:()=>room_?selectFx(null):select(null),
    del:()=>{if(!room_)return removeSel();const R=room();mutate(()=>{R.fixtures=R.fixtures.filter(f=>f.id!==selFx.id);R.openings=R.openings.filter(o=>o.id!==selFx.id);selFx=null})},
    props:()=>$('#inspector').scrollIntoView({behavior:'smooth'}),done:()=>setMode('items'),
    wishadd:()=>{const d=$('#wishFormBox');if(d){d.open=true;d.scrollIntoView({behavior:'smooth'});$('#w-name').focus()}},toplan:()=>setView('2d'),
    l:()=>nudge(-1,0),r:()=>nudge(1,0),u:()=>nudge(0,-1),d:()=>nudge(0,1)};
  (acts[b.dataset.act]||(()=>{}))();
}
