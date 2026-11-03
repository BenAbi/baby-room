/* arranque y eventos */
function setView(v){
  view=v;
  $$('#viewSeg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===v));
  document.body.classList.toggle('mode-list',v==='list');
  document.body.classList.toggle('mode-3d',v==='3d');
  $('#planwrap').hidden=v!=='2d';$('#legend').hidden=v!=='2d';$('#wrap3d').hidden=v!=='3d';$('#wishView').hidden=v!=='list';
  if(v!=='2d'&&mode==='room'){mode='items';selFx=null;renderCatalog()}
  renderAll();
  if(v==='3d')open3d();
  if(v==='list')window.scrollTo({top:0});
}

function start(){
  S=load()||seed();save();
  $('#plan').addEventListener('pointerdown',onDown);
  $('#plan').addEventListener('pointermove',onMove);
  $('#plan').addEventListener('pointerup',onUp);
  $('#plan').addEventListener('pointercancel',onUp);
  $('#plan').addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey&&Z.k===1)return;e.preventDefault();const p=pt(e);zoomBy(e.deltaY<0?1.15:1/1.15,p.x,p.y)},{passive:false});
  $('#zoomSeg').addEventListener('click',e=>{const b=e.target.closest('[data-z]');if(!b)return;const z=b.dataset.z;if(z==='fit'){Z={k:1,cx:null,cy:null};applyZoom()}else zoomBy(z==='in'?1.4:1/1.4)});
  document.addEventListener('keydown',onKey);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-sel]');if(b){if(mode==='room')setMode('items');select(b.dataset.sel)}});
  $('#catBody').addEventListener('click',e=>{
    const a=e.target.closest('[data-add]');if(a){place(catSpec(a.dataset.add));return}
    const d=e.target.closest('[data-delc]');if(d){S.custom.splice(+d.dataset.delc,1);save();renderCatalog();return}
    const f=e.target.closest('[data-addfx]');if(f)addFixture(f.dataset.addfx);
  });
  $('#chips').addEventListener('click',e=>{const b=e.target.closest('[data-l]');if(!b)return;room().active=b.dataset.l;selId=null;save();renderAll()});
  $('#roomSel').addEventListener('change',e=>{
    const v=e.target.value;
    if(v==='__new'){newRoom(`Habitación ${S.rooms.length+1}`,300,300);return}
    S.roomId=v;selId=null;selFx=null;Z={k:1,cx:null,cy:null};save();renderAll();
  });
  $('#newLayout').addEventListener('click',()=>mutate(()=>{const R=room(),c=clone(cur());c.id=uid('l');c.name=cur().name+' (copia)';c.items.forEach(i=>i.id=uid());R.layouts.push(c);R.active=c.id;selId=null}));
  $('#layoutName').addEventListener('change',e=>mutate(()=>{cur().name=e.target.value.trim()||cur().name}));
  armed($('#delLayout'),()=>{const R=room();if(R.layouts.length<2)return;mutate(()=>{R.layouts=R.layouts.filter(l=>l.id!==cur().id);R.active=R.layouts[0].id;selId=null})});
  $('#snap').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;S.snap=+b.dataset.v;save();renderAll({keepInspector:1})});
  $('#undo').addEventListener('click',undo);
  $('#viewSeg').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view)});
  $('#modeSeg').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b)setMode(b.dataset.mode)});
  $('#mbar').addEventListener('click',onMbar);
  $('#scrim').addEventListener('click',()=>sheet(false));
  $('#closeSheet').addEventListener('click',()=>sheet(false));
  $('#wishView').addEventListener('click',onWishClick);
  $('#rot3d').addEventListener('click',()=>{if(!T3.renderer)return;corner=(corner+1)%4;isoView()});
  $('#walk3d').addEventListener('click',()=>setWalk(!walk));
  // archivo
  $('#exportFile').addEventListener('click',exportFile);
  $('#importFile').addEventListener('change',e=>{const f=e.target.files[0];if(f)importFile(f);e.target.value=''});
  $('#exportLayout').addEventListener('click',exportLayout);
  $('#importLayout').addEventListener('click',importLayout);
  $('#pngPlan').addEventListener('click',exportPlanPng);
  $('#png3d').addEventListener('click',export3dPng);
  $('#printPlan').addEventListener('click',printPlan);

  renderCatalog();setView('2d');
  // aplicación instalable: solo en la web publicada (con manifiesto)
  if('serviceWorker' in navigator&&document.querySelector('link[rel=manifest]')&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
}
start();
