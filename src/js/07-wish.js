/* lista de compra: muebles que queremos incorporar, con precio, estado y prueba en el plano */
let wishFilter='all',wishEdit=null,wishFocus=null;
function wishFromItem(it){return {id:uid('w'),name:it.name,w:it.w,d:it.d,h:it.h,type:it.type,kind:it.kind,shape:it.shape,color:it.color,link:'',price:0,qty:1,roomId:room().id,status:'idea',notes:''}}
const wishSpec=w=>({name:w.name,w:w.w||60,d:w.d||60,h:w.h||0,type:w.type||'box',kind:w.kind||TYPE_KIND[w.type]||'floor',shape:w.shape||'rect',color:w.color||'stone',wid:w.id});
function wishPlaced(w){
  const out=[];
  for(const r of S.rooms)for(const l of r.layouts)if(l.items.some(i=>i.wid===w.id))out.push(r.id===room().id?l.name:`${r.name} · ${l.name}`);
  return out;
}
function wishTotals(){
  let total=0,bought=0;
  for(const w of S.wishlist){const v=(+w.price||0)*(+w.qty||1);total+=v;if(w.status==='comprado'||w.status==='montado')bought+=v}
  return {total,bought,pending:total-bought};
}
function renderWish(){
  const box=$('#wishView'),t=wishTotals(),ed=wishEdit&&S.wishlist.find(w=>w.id===wishEdit);
  const v=ed||{name:'',w:'',d:'',h:'',type:'box',link:'',price:'',qty:1,roomId:room().id,status:'idea',notes:'',color:'stone'};
  const list=S.wishlist.filter(w=>wishFilter==='all'||w.status===wishFilter);
  const counts=Object.fromEntries(STATUSES.map(([k])=>[k,S.wishlist.filter(w=>w.status===k).length]));
  const catOpts={'':'— Elegir del catálogo para rellenar medidas —'};
  CATALOG.forEach((g,gi)=>g.items.forEach((i,ii)=>{catOpts[`${gi}.${ii}`]=`${g.group} · ${i.name} (${i.w}×${i.d})`}));
  S.custom.forEach((i,ii)=>{catOpts[`c.${ii}`]=`Mis muebles · ${i.name} (${i.w}×${i.d})`});
  box.innerHTML=`
  <div class="wishtop">
    <div><h2>Lista de compra</h2><p class="note">Lo que queréis incorporar en casa. Pruébalo en el plano antes de comprarlo.</p></div>
    <div class="totals">
      <div class="tot"><span class="note">Presupuesto</span><strong>${eur(t.total)}</strong></div>
      <div class="tot"><span class="note">Comprado</span><strong class="okc">${eur(t.bought)}</strong></div>
      <div class="tot"><span class="note">Falta</span><strong class="accent">${eur(t.pending)}</strong></div>
    </div>
  </div>
  <div class="seg wfilter" role="group" aria-label="Filtrar por estado"><button data-wf="all" aria-pressed="${wishFilter==='all'}">Todo (${S.wishlist.length})</button>${STATUSES.map(([k,l])=>`<button data-wf="${k}" aria-pressed="${wishFilter===k}">${l} (${counts[k]})</button>`).join('')}</div>
  <details id="wishFormBox" class="panel"${ed||!S.wishlist.length?' open':''}><summary>${ed?'Editar «'+esc(ed.name)+'»':'+ Añadir a la lista'}</summary>
    <form id="wishForm" class="stack">
      ${selF('w-cat','Rellenar desde el catálogo',catOpts,'')}
      <div class="grid2">${txtF('w-name','Nombre *',v.name,'p. ej. Cómoda HEMNES')}${txtF('w-link','Enlace a la tienda',v.link,'https://…')}</div>
      <div class="grid3">${numF('w-w','Ancho',v.w)}${numF('w-d','Fondo',v.d)}${numF('w-h','Alto',v.h)}</div>
      <div class="grid3">${numF('w-price','Precio (€)',v.price,'min="0" step="0.01"')}${numF('w-qty','Cantidad',v.qty,'min="1"')}${selF('w-status','Estado',Object.fromEntries(STATUSES),v.status)}</div>
      <div class="grid2">${selF('w-room','Habitación',Object.fromEntries(S.rooms.map(r=>[r.id,r.name])),v.roomId)}${selF('w-type','Modelo 3D',TYPES,v.type)}</div>
      ${txtF('w-notes','Notas',v.notes,'color, medidas a confirmar, tienda…')}
      <div class="btnrow"><button class="btn primary" type="submit">${ed?'Guardar cambios':'Añadir a la lista'}</button>${ed?'<button class="btn" type="button" id="w-cancel">Cancelar</button>':''}</div>
    </form>
  </details>
  <ul class="wlist">${list.map(w=>{
    const link=safeLink(w.link),placed=wishPlaced(w),sub=(+w.price||0)*(+w.qty||1),rn=(S.rooms.find(r=>r.id===w.roomId)||{}).name||'';
    return `<li class="witem st-${w.status}${w.id===wishFocus?' focus':''}" id="wi-${w.id}">
      <button class="wstatus" data-wcycle="${w.id}" title="Cambiar estado">${statusName(w.status)}</button>
      <div class="wmain">
        <div class="wname">${link?`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(w.name)}</a>`:esc(w.name)}${w.qty>1?` <span class="note">× ${w.qty}</span>`:''}</div>
        <div class="note">${[w.w&&w.d?`${w.w}×${w.d}${w.h?'×'+w.h:''} cm`:'',rn,w.notes].filter(Boolean).map(esc).join(' · ')}</div>
        ${placed.length?`<div class="wplaced">✓ En el plano: ${esc(placed.join(', '))}</div>`:''}
      </div>
      <div class="wprice">${sub?eur(sub):'<span class="note">sin precio</span>'}</div>
      <div class="btnrow"><button class="btn" data-wtry="${w.id}"${w.w&&w.d?'':' disabled title="Añade ancho y fondo para probarlo"'}>Probar en el plano</button><button class="btn" data-wedit="${w.id}">Editar</button><button class="btn danger" data-wdel="${w.id}">Quitar</button></div>
    </li>`}).join('')||`<li class="note">${S.wishlist.length?'Nada con este estado.':'La lista está vacía. Añade el primer mueble con el formulario de arriba, o desde un mueble del plano con «Añadir a la lista de compra».'}</li>`}</ul>`;

  $('#w-cat').onchange=e=>{const s=e.target.value&&catSpec(e.target.value);if(!s)return;if(!$('#w-name').value)$('#w-name').value=s.name;$('#w-w').value=s.w;$('#w-d').value=s.d;$('#w-h').value=s.h||0;$('#w-type').value=s.type||inferType(s.name,s.kind)};
  $('#wishForm').onsubmit=e=>{
    e.preventDefault();const name=$('#w-name').value.trim();if(!name){$('#w-name').focus();return}
    const data={name,link:$('#w-link').value.trim(),w:num($('#w-w').value)||0,d:num($('#w-d').value)||0,h:num($('#w-h').value)||0,price:num($('#w-price').value)||0,qty:Math.max(1,num($('#w-qty').value)||1),status:$('#w-status').value,roomId:$('#w-room').value,type:$('#w-type').value,notes:$('#w-notes').value.trim()};
    data.kind=TYPE_KIND[data.type]||'floor';
    mutate(()=>{if(ed)Object.assign(ed,data);else S.wishlist.push({id:uid('w'),shape:'rect',color:'stone',...data});wishEdit=null});
  };
  if($('#w-cancel'))$('#w-cancel').onclick=()=>{wishEdit=null;renderWish()};
  box.querySelectorAll('[data-wdel]').forEach(b=>armed(b,()=>mutate(()=>{S.wishlist=S.wishlist.filter(w=>w.id!==b.dataset.wdel)})));
  if(wishFocus){const el=$('#wi-'+wishFocus);if(el)el.scrollIntoView({block:'center'});wishFocus=null}
}
function onWishClick(e){
  const b=e.target.closest('[data-wf],[data-wcycle],[data-wtry],[data-wedit]');if(!b)return;
  if(b.dataset.wf){wishFilter=b.dataset.wf;renderWish();return}
  const w=S.wishlist.find(x=>x.id===(b.dataset.wcycle||b.dataset.wtry||b.dataset.wedit));if(!w)return;
  if(b.dataset.wcycle){const i=STATUSES.findIndex(s=>s[0]===w.status);mutate(()=>{w.status=STATUSES[(i+1)%STATUSES.length][0]});return}
  if(b.dataset.wedit){wishEdit=w.id;renderWish();$('#wishFormBox').scrollIntoView({behavior:'smooth'});return}
  if(b.dataset.wtry){
    if(S.rooms.some(r=>r.id===w.roomId))S.roomId=w.roomId;
    setMode('items');setView('2d');
    const ex=cur().items.find(i=>i.wid===w.id);
    if(ex)select(ex.id);else place(wishSpec(w));
  }
}
