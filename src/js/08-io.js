/* copias de seguridad, compartir distribuciones, imágenes e impresión */
const msg=t=>{$('#fileMsg').textContent=t};
function exportFile(){
  const data={app:'planificador-casa',v:4,fecha:new Date().toISOString(),data:S};
  try{download(`casa-${today()}.json`,new Blob([JSON.stringify(data,null,1)],{type:'application/json'}));msg('Copia descargada. Guárdala en un sitio seguro (Drive, correo…).')}
  catch(e){msg('Este navegador no permite descargar. Usa «Copiar la distribución» de abajo.')}
}
function importData(d){
  if(d&&d.data&&d.data.rooms){pushUndo();S=upgrade(d.data);selId=null;selFx=null;save();renderCatalog();renderAll();return 'Copia restaurada. Si no era lo que querías, pulsa Deshacer.'}
  if(d&&d.rooms){pushUndo();S=upgrade(d);selId=null;selFx=null;save();renderCatalog();renderAll();return 'Copia restaurada. Si no era lo que querías, pulsa Deshacer.'}
  if(d&&d.layouts&&d.room){pushUndo();S=fromV1(d);selId=null;save();renderCatalog();renderAll();return 'Datos de la versión anterior restaurados.'}
  if(d&&Array.isArray(d.items)){
    mutate(()=>{const R=room(),l={id:uid('l'),name:String(d.name||'Importada'),items:d.items.map(i=>({...i,id:uid()}))};fixItems(l.items);l.items.forEach(i=>clampItem(i,R));R.layouts.push(l);R.active=l.id;selId=null});
    return 'Distribución añadida como «'+cur().name+'».';
  }
  return 'El archivo no contiene datos del planificador.';
}
function importFile(file){
  const rd=new FileReader();
  rd.onload=()=>{let d;try{d=JSON.parse(rd.result)}catch(e){msg('No se puede leer el archivo.');return}msg(importData(d))};
  rd.readAsText(file);
}
function exportLayout(){
  const l=cur(),txt=JSON.stringify({name:l.name,items:l.items.map(({id,...i})=>i)}),ta=$('#shareText');
  ta.value=txt;
  const ok=()=>msg('Distribución copiada. Pégala en el otro dispositivo o envíala.');
  const fallback=()=>{ta.focus();ta.select();msg('Texto seleccionado: cópialo con Ctrl+C (o mantén pulsado en el móvil).')};
  try{navigator.clipboard.writeText(txt).then(ok,fallback)}catch(e){fallback()}
}
function importLayout(){
  let d;try{d=JSON.parse($('#shareText').value.trim())}catch(e){msg('No se reconoce el texto. Pega el texto completo que copiaste.');return}
  msg(importData(d));$('#shareText').value='';
}

// el plano usa variables CSS: se copian los estilos calculados para que la imagen salga igual
const STYLE_PROPS=['fill','fill-opacity','stroke','stroke-width','stroke-dasharray','stroke-opacity','opacity','font-family','font-size','font-weight','paint-order','text-anchor'];
function svgToPng(scale){
  const src=$('#plan'),cl=src.cloneNode(true),a=[src,...src.querySelectorAll('*')],b=[cl,...cl.querySelectorAll('*')];
  a.forEach((el,i)=>{const cs=getComputedStyle(el);b[i].setAttribute('style',STYLE_PROPS.map(p=>`${p}:${cs.getPropertyValue(p)}`).join(';'))});
  const vb=src.viewBox.baseVal,w=Math.round(vb.width*scale),h=Math.round(vb.height*scale);
  cl.setAttribute('width',w);cl.setAttribute('height',h);
  const bg=getComputedStyle(document.body).getPropertyValue('--panel').trim()||'#fff';
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,w,h);x.drawImage(img,0,0);c.toBlob(res,'image/png')};
    img.onerror=rej;
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(cl));
  });
}
const fileName=()=>`${room().name} - ${cur().name}`.replace(/[\\/:*?"<>|]/g,'').trim();
async function exportPlanPng(){
  if(view!=='2d')setView('2d');
  const prev=selId;selId=null;render();
  try{download(fileName()+'.png',await svgToPng(3));msg('Imagen del plano descargada.')}catch(e){msg('No se pudo crear la imagen en este navegador.')}
  selId=prev;render();
}
function export3dPng(){
  if(!T3.renderer){msg('Abre primero la vista 3D.');return}
  T3.renderer.render(T3.scene,T3.active.cam);
  T3.renderer.domElement.toBlob(b=>{if(b){download(fileName()+' 3D.png',b);msg('Imagen 3D descargada.')}else msg('No se pudo crear la imagen 3D.')},'image/png');
}
function printPlan(){
  if(view!=='2d')setView('2d');
  const R=room(),l=cur(),prev=selId;selId=null;render();
  const rows=l.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${i.w}×${i.d}${i.h?'×'+i.h:''}</td><td>${r1(i.x)} / ${r1(i.y)}</td></tr>`).join('');
  const wl=S.wishlist.filter(w=>w.roomId===R.id),t=wl.reduce((s,w)=>s+(+w.price||0)*(+w.qty||1),0);
  $('#printArea').innerHTML=`<h2>${esc(R.name)} · ${esc(l.name)}</h2><p>${R.W} × ${R.L} cm · ${new Date().toLocaleDateString('es-ES')}</p>
  <table><thead><tr><th>Mueble</th><th>Medidas (cm)</th><th>Posición x / y</th></tr></thead><tbody>${rows}</tbody></table>
  ${wl.length?`<h3>Lista de compra de esta habitación</h3><table><thead><tr><th>Mueble</th><th>Estado</th><th>Precio</th></tr></thead><tbody>${wl.map(w=>`<tr><td>${esc(w.name)}${w.qty>1?' × '+w.qty:''}</td><td>${statusName(w.status)}</td><td>${w.price?eur(w.price*(w.qty||1)):''}</td></tr>`).join('')}</tbody></table><p><strong>Total: ${eur(t)}</strong></p>`:''}`;
  setTimeout(()=>{window.print();selId=prev;render()},60);
}
