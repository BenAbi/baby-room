/* paneles: cabecera, avisos, inspector, catálogo y barra del móvil */
let view='2d'; // '2d' · '3d' · 'list'
const numF=(id,label,val,opt)=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" type="number" ${opt||'min="0"'} value="${val??''}"></div>`;
const txtF=(id,label,val,ph)=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(val)}"${ph?` placeholder="${esc(ph)}"`:''}></div>`;
const selF=(id,label,opts,val)=>`<div class="field"><label for="${id}">${label}</label><select id="${id}">${Object.entries(opts).map(([k,v])=>`<option value="${esc(k)}"${k===String(val)?' selected':''}>${esc(v)}</option>`).join('')}</select></div>`;
const chkF=(id,label,val)=>`<label class="chk"><input id="${id}" type="checkbox"${val?' checked':''}> ${label}</label>`;
const num=v=>{const n=parseFloat(String(v).replace(',','.'));return isNaN(n)?null:n};
const startName=(R,side)=>{const lb=R.labels||DEFAULT_LABELS;return side==='top'||side==='bottom'?lb.left:lb.top};
const statusName=s=>(STATUSES.find(x=>x[0]===s)||STATUSES[0])[1];

function renderHeader(){
  const R=room();
  $('#roomTitle').textContent=R.name;
  $('#roomSel').innerHTML=S.rooms.map(r=>`<option value="${r.id}"${r.id===R.id?' selected':''}>${esc(r.name)}</option>`).join('')+`<option value="__new">+ Nueva habitación…</option>`;
  $('#roomsub').textContent=`Plano a escala · ${R.W} × ${R.L} cm`;
  $('#chips').innerHTML=R.layouts.map(l=>`<button class="chip" data-l="${l.id}" aria-pressed="${l.id===cur().id}">${esc(l.name)}</button>`).join('');
  const ln=$('#layoutName');if(document.activeElement!==ln)ln.value=cur().name;
  $('#delLayout').disabled=R.layouts.length<2;
  document.title=`${R.name} · Planificador de casa`;
}

function renderStatus(A){
  const e=A.warns.filter(w=>w.l==='err').length,w=A.warns.length-e,p=$('#status');
  p.className='pill nolist '+(e?'err':w?'warn':'ok');
  p.textContent=e?`${e} choque${e>1?'s':''}${w?` · ${w} aviso${w>1?'s':''}`:''}`:w?`${w} aviso${w>1?'s':''}`:'Sin conflictos';
  const li=x=>`<li><button data-sel="${x.id}"><span class="dot ${x.l}"></span><span>${esc(x.t)}</span></button></li>`;
  $('#warns').innerHTML=(A.warns.length?A.warns.map(li).join(''):`<li class="okmsg">Todo cabe sin chocar.</li>`)
    +(A.info.length?`<li><details class="passes"${A.info.some(x=>x.id===selId)?' open':''}><summary>${A.info.length} paso${A.info.length>1?'s':''} estrecho${A.info.length>1?'s':''} (menos de ${S.minPass} cm)</summary><ul class="warns">${A.info.map(li).join('')}</ul></details></li>`:'');
  $('#items').innerHTML=cur().items.map(i=>`<li><button data-sel="${i.id}" aria-current="${i.id===selId}"><span class="dot ${A.st.get(i.id)||(i.kind==='floor'?'':'none')}"></span><span>${esc(i.name)}${i.locked?' <span class="note">· fijo</span>':''}</span><span class="m">${i.w}×${i.d}</span></button></li>`).join('')||`<li class="note">Plano vacío. Añade muebles desde el catálogo.</li>`;
}

/* inspector */
function renderInspector(){
  const el=$('#sel');el.onchange=null;el.oninput=null;
  $('#itemsPanels').hidden=mode==='room';
  if(mode==='room'){
    const f=selFixture(),o=selOpening();
    $('#selTitle').textContent=f?fxLabel(f):o?opLabel(o):'Habitación';
    return f?fixtureInspector(f,el):o?openingInspector(o,el):roomInspector(el);
  }
  const it=selItem();
  $('#selTitle').textContent='Seleccionado';
  if(!it){el.innerHTML=`<p class="hint">Toca un mueble del plano para seleccionarlo y arrástralo para moverlo. Con uno seleccionado: <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> mueven 1 cm (con <kbd>Mayús</kbd> 10 cm), <kbd>R</kbd> gira y <kbd>Supr</kbd> lo quita.</p>`;return}
  itemInspector(it,el);
}
function itemInspector(it,el){
  const R=room(),lb=R.labels||DEFAULT_LABELS,w=it.wid&&S.wishlist.find(x=>x.id===it.wid);
  el.innerHTML=`
  ${txtF('f-name','Nombre',it.name)}
  <div class="grid3">${numF('f-w','Ancho',it.w,'min="1"')}${numF('f-d','Fondo',it.d,'min="1"')}${numF('f-h','Alto',it.h)}</div>
  <div class="grid2">${numF('f-x','Desde la '+lb.left,r1(it.x))}${numF('f-y','Desde la '+lb.top,r1(it.y))}</div>
  <div class="grid2">${selF('f-kind','Colocación',KINDS,it.kind)}${selF('f-type','Modelo 3D',TYPES,it.type)}</div>
  <div class="grid2">${selF('f-shape','Forma',{rect:'Rectangular',round:'Redonda'},it.shape)}<div class="field"><label>Color</label><div class="swatches" role="group" aria-label="Color">${COLORS.map(c=>`<button data-c="${c}" aria-pressed="${c===it.color}" aria-label="${COLOR_NAMES[c]}" title="${COLOR_NAMES[c]}" style="background:var(--i-${c})"></button>`).join('')}</div></div></div>
  <div class="btnrow"><button class="btn" id="b-rot">Girar 90°</button><button class="btn" id="b-dup">Duplicar</button><button class="btn" id="b-lock" aria-pressed="${it.locked}">${it.locked?'Soltar':'Fijar'}</button><button class="btn danger" id="b-del">Quitar</button></div>
  <div class="wishlink">${w?`<span>En la lista de compra: <strong>${statusName(w.status)}</strong>${w.price?' · '+eur(w.price*(w.qty||1)):''}</span><button class="btn" id="b-wish-go" type="button">Ver lista</button>`:`<button class="btn" id="b-wish" type="button">+ Añadir a la lista de compra</button>`}</div>`;
  const H={
    'f-name':v=>{it.name=v.trim()||it.name},
    'f-w':v=>{const n=num(v);if(n>0)it.w=n},'f-d':v=>{const n=num(v);if(n>0)it.d=n},'f-h':v=>{const n=num(v);if(n>=0)it.h=n},
    'f-x':v=>{const n=num(v);if(n!==null)it.x=n},'f-y':v=>{const n=num(v);if(n!==null)it.y=n},
    'f-kind':v=>{it.kind=v},'f-type':v=>{it.type=v;if(TYPE_KIND[v])it.kind=TYPE_KIND[v];it.baby=!!BABY_TYPES[v]},'f-shape':v=>{it.shape=v}
  };
  el.onchange=e=>{const fn=H[e.target.id];if(fn)mutate(()=>{fn(e.target.value);clampItem(it)})};
  el.querySelectorAll('[data-c]').forEach(b=>b.addEventListener('click',()=>mutate(()=>{it.color=b.dataset.c})));
  $('#b-rot').onclick=rotateSel;$('#b-dup').onclick=dupSel;$('#b-del').onclick=removeSel;$('#b-lock').onclick=lockSel;
  if($('#b-wish'))$('#b-wish').onclick=()=>mutate(()=>{const x=wishFromItem(it);S.wishlist.push(x);it.wid=x.id});
  if($('#b-wish-go'))$('#b-wish-go').onclick=()=>{wishFocus=it.wid;setView('list')};
}
function fixtureInspector(f,el){
  const R=room(),walls={...SIDE_NAMES,'':'Suelto (no pegado a una pared)'};
  const lw=s=>`${SIDE_NAMES[s]} · ${(R.labels||DEFAULT_LABELS)[s]}`;
  el.innerHTML=`
  ${txtF('x-label','Nombre',fxLabel(f))}
  <div class="grid2">${selF('x-type','Tipo',Object.fromEntries(Object.entries(FIX).map(([k,v])=>[k,v.label])),f.type)}${selF('x-wall','Pared',Object.fromEntries(Object.keys(walls).map(k=>[k,k?lw(k):walls[k]])),f.wall||'')}</div>
  ${f.wall?`<div class="grid2">${numF('x-pos','Desde la '+startName(R,f.wall),r1(f.pos))}${numF('x-len','Largo',f.len,'min="1"')}</div>`
          :`<div class="grid2">${numF('x-x','Desde la '+R.labels.left,r1(f.x))}${numF('x-y','Desde la '+R.labels.top,r1(f.y))}</div>${numF('x-len','Ancho',f.len,'min="1"')}`}
  <div class="grid2">${numF('x-depth',f.inset?'Fondo (dentro de la pared)':'Fondo (sobresale)',f.depth,'min="1"')}${numF('x-h','Alto',f.h)}</div>
  ${f.wall?`<div class="grid2">${chkF('x-inset','Empotrado en la pared',f.inset)}${f.inset?numF('x-rh','Altura del hueco',f.rh||R.H):''}</div>
  ${numF('x-clear','Zona de apertura delante (puertas)',f.clear||0)}`:''}
  <div class="btnrow"><button class="btn" id="x-dup">Duplicar</button><button class="btn danger" id="x-del">Quitar</button></div>
  <p class="note">Arrastra el elemento en el plano para moverlo a lo largo de su pared.</p>`;
  const H={
    'x-label':v=>{f.label=v.trim()||f.label},
    'x-type':v=>{const m=FIX[v];if(fxLabel(f)===fxMeta(f).label)f.label=m.label;f.type=v;if(v==='wardrobe'||v==='niche')f.inset=true},
    'x-wall':v=>{if(v&&!f.wall){f.pos=0}if(!v&&f.wall){const r=fixRect(R,f);f.x=Math.max(0,r.x);f.y=Math.max(0,r.y);f.inset=false}f.wall=v},
    'x-pos':v=>{const n=num(v);if(n!==null)f.pos=n},'x-len':v=>{const n=num(v);if(n>0)f.len=n},'x-x':v=>{const n=num(v);if(n!==null)f.x=n},'x-y':v=>{const n=num(v);if(n!==null)f.y=n},
    'x-depth':v=>{const n=num(v);if(n>0)f.depth=n},'x-h':v=>{const n=num(v);if(n>=0)f.h=n},'x-rh':v=>{const n=num(v);if(n>0)f.rh=n},'x-clear':v=>{const n=num(v);if(n>=0)f.clear=n}
  };
  el.onchange=e=>{
    if(e.target.id==='x-inset'){mutate(()=>{f.inset=e.target.checked});return}
    const fn=H[e.target.id];if(fn)mutate(()=>{fn(e.target.value);clampFixture(f,R)});
  };
  $('#x-del').onclick=()=>mutate(()=>{R.fixtures=R.fixtures.filter(x=>x!==f);selFx=null});
  $('#x-dup').onclick=()=>mutate(()=>{const c={...clone(f),id:uid('f')};if(c.wall)c.pos+=c.len+10;else{c.x+=10;c.y+=10}clampFixture(c,R);R.fixtures.push(c);selFx={k:'fx',id:c.id}});
}
function openingInspector(o,el){
  const R=room(),sn=startName(R,o.wall);
  el.innerHTML=`
  <div class="grid2">${selF('o-type','Tipo',{door:'Puerta',window:'Ventana'},o.type)}${selF('o-wall','Pared',Object.fromEntries(SIDES.map(s=>[s,`${SIDE_NAMES[s]} · ${(R.labels||DEFAULT_LABELS)[s]}`])),o.wall)}</div>
  <div class="grid2">${numF('o-pos','Desde la '+sn,r1(o.pos))}${numF('o-width',o.type==='door'?'Ancho de la hoja':'Ancho con marco',o.width,'min="1"')}</div>
  <div class="grid2">${numF('o-height','Alto',o.height)}${o.type==='window'?numF('o-sill','Altura del alféizar',o.sill):numF('o-frame','Marco a cada lado',o.frame||0)}</div>
  ${o.type==='door'?selF('o-hinge','Bisagras',{start:'Lado de la '+sn,end:'Lado contrario'},o.hinge):''}
  <div class="btnrow"><button class="btn danger" id="o-del">Quitar</button></div>
  <p class="note">Arrastra la ${o.type==='door'?'puerta':'ventana'} en el plano para moverla a lo largo de la pared.</p>`;
  const H={
    'o-type':v=>{o.type=v;Object.entries(OPEN[v]).forEach(([k,d])=>{if(k!=='label'&&o[k]===undefined)o[k]=d})},
    'o-wall':v=>{o.wall=v},'o-pos':v=>{const n=num(v);if(n!==null)o.pos=n},'o-width':v=>{const n=num(v);if(n>0)o.width=n},
    'o-height':v=>{const n=num(v);if(n>0)o.height=n},'o-sill':v=>{const n=num(v);if(n>=0)o.sill=n},'o-frame':v=>{const n=num(v);if(n>=0)o.frame=n},'o-hinge':v=>{o.hinge=v}
  };
  el.onchange=e=>{const fn=H[e.target.id];if(fn)mutate(()=>{fn(e.target.value);clampOpening(o,R)})};
  $('#o-del').onclick=()=>mutate(()=>{R.openings=R.openings.filter(x=>x!==o);selFx=null});
}
function roomInspector(el){
  const R=room(),lb=R.labels||DEFAULT_LABELS;
  el.innerHTML=`
  <p class="hint">Toca una puerta, ventana o elemento fijo del plano para editarlo, o añade otros desde el panel.</p>
  ${txtF('r-name','Nombre de la habitación',R.name)}
  <div class="grid3">${numF('r-W','Ancho',R.W,'min="50"')}${numF('r-L','Largo',R.L,'min="50"')}${numF('r-H','Techo',R.H)}</div>
  <p class="note">Ancho = ${esc(lb.top)} · Largo = ${esc(lb.left)}</p>
  <div class="grid2">${SIDES.map(s=>txtF('r-lb-'+s,'Nombre: '+SIDE_NAMES[s].toLowerCase(),lb[s])).join('')}</div>
  ${chkF('r-lamp','Lámpara en el centro del techo',R.lamp)}
  ${numF('r-pass','Paso mínimo para avisar (cm)',S.minPass,'min="20"')}
  <div class="btnrow">${R.id==='r1'?'<button class="btn danger" id="r-reset">Restaurar medidas iniciales</button>':''}${S.rooms.length>1?'<button class="btn danger" id="r-del">Borrar habitación</button>':''}</div>`;
  el.onchange=e=>{
    const id=e.target.id,v=e.target.value;
    if(id==='r-lamp')return mutate(()=>{R.lamp=e.target.checked});
    if(id==='r-name')return mutate(()=>{R.name=v.trim()||R.name});
    if(id.startsWith('r-lb-'))return mutate(()=>{R.labels={...lb,[id.slice(5)]:v.trim()||DEFAULT_LABELS[id.slice(5)]}});
    const n=num(v);if(n===null)return;
    if(id==='r-pass'&&n>=20)return mutate(()=>{S.minPass=n});
    if((id==='r-W'||id==='r-L')&&n>=50)return mutate(()=>{R[id.slice(2)]=n;fitRoom(R)});
    if(id==='r-H'&&n>=150)mutate(()=>{R.H=n});
  };
  armed($('#r-reset'),()=>mutate(()=>{const b=babyRoomFrom(BABY0);Object.assign(R,{W:b.W,L:b.L,H:b.H,labels:b.labels,openings:b.openings,fixtures:b.fixtures,lamp:true});fitRoom(R)}));
  armed($('#r-del'),()=>mutate(()=>{S.rooms=S.rooms.filter(x=>x!==R);S.roomId=S.rooms[0].id;selId=null;selFx=null}));
}
function fitRoom(R){R.fixtures.forEach(f=>clampFixture(f,R));R.openings.forEach(o=>clampOpening(o,R));R.layouts.forEach(l=>l.items.forEach(i=>clampItem(i,R)))}

/* catálogo (modo muebles) o elementos de la habitación (modo habitación) */
function renderCatalog(){
  const box=$('#catBody');
  if(mode==='room'){
    $('#catTitle').textContent='Añadir a la habitación';
    const b=(k,l,m)=>`<button class="add" data-addfx="${k}"><span class="n">${l}</span><span class="m">${m}</span></button>`;
    box.innerHTML=`<div class="cat-group"><h3>Huecos</h3>${b('door','Puerta','76 cm')}${b('window','Ventana','100 cm')}</div>
    <div class="cat-group"><h3>Elementos fijos</h3>${b('radiator','Radiador','80×12')}${b('column','Columna','30×10')}${b('wardrobe','Armario empotrado','100×60')}${b('niche','Hueco en la pared','80×30')}${b('box','Elemento fijo','60×60')}</div>
    <details><summary>Nueva habitación</summary><form id="roomForm" class="stack">
      ${txtF('n-name','Nombre','','p. ej. Salón')}
      <div class="grid2">${numF('n-W','Ancho',300,'min="50" required')}${numF('n-L','Largo',300,'min="50" required')}</div>
      <button class="btn primary" type="submit">Crear habitación</button></form></details>`;
    $('#roomForm').onsubmit=e=>{e.preventDefault();newRoom($('#n-name').value.trim()||`Habitación ${S.rooms.length+1}`,num($('#n-W').value)||300,num($('#n-L').value)||300)};
    return;
  }
  $('#catTitle').textContent='Añadir mueble';
  const groups=[...CATALOG.map((g,gi)=>({name:g.group,items:g.items.map((i,ii)=>({i,key:`${gi}.${ii}`}))}))];
  if(S.custom.length)groups.unshift({name:'Mis muebles',mine:1,items:S.custom.map((i,ii)=>({i,key:`c.${ii}`}))});
  box.innerHTML=`<div class="cats">${groups.map(g=>`<div class="cat-group"><h3>${esc(g.name)}</h3>${g.items.map(({i,key})=>`<div class="addrow"><button class="add" data-add="${key}"><span class="n">${esc(i.name)}</span><span class="m">${i.w}×${i.d}</span></button>${g.mine?`<button class="xbtn" data-delc="${key.slice(2)}" aria-label="Quitar de Mis muebles" title="Quitar de Mis muebles">×</button>`:''}</div>`).join('')}</div>`).join('')}</div>
  <details id="customBox"><summary>Mueble a medida</summary>
    <form id="customForm" class="stack">
      ${txtF('c-name','Nombre','','p. ej. Cómoda de la abuela')}
      <div class="grid3">${numF('c-w','Ancho',80,'min="1" required')}${numF('c-d','Fondo',45,'min="1" required')}${numF('c-h','Alto',90)}</div>
      <div class="grid2">${selF('c-type','Modelo 3D',TYPES,'box')}${selF('c-kind','Colocación',KINDS,'floor')}</div>
      <div class="grid2">${selF('c-shape','Forma',{rect:'Rectangular',round:'Redonda'},'rect')}${selF('c-color','Color',COLOR_NAMES,'stone')}</div>
      ${chkF('c-save','Guardar en «Mis muebles» para reutilizarlo',true)}
      <button class="btn primary" type="submit">Añadir al plano</button>
    </form></details>`;
  $('#c-type').onchange=e=>{const k=TYPE_KIND[e.target.value];if(k)$('#c-kind').value=k};
  $('#customForm').onsubmit=e=>{
    e.preventDefault();const w=num($('#c-w').value),d=num($('#c-d').value);if(!(w>0&&d>0))return;
    const spec={name:$('#c-name').value.trim()||'Mueble',w,d,h:num($('#c-h').value)||0,type:$('#c-type').value,kind:$('#c-kind').value,shape:$('#c-shape').value,color:$('#c-color').value};
    if($('#c-save').checked&&!S.custom.some(c=>c.name===spec.name&&c.w===w&&c.d===d))S.custom.push(spec);
    place(spec);renderCatalog();
  };
}
function catSpec(key){const[g,i]=key.split('.');return g==='c'?S.custom[+i]:CATALOG[+g].items[+i]}

/* barra inferior del móvil */
function renderMbar(A){
  const m=$('#mbar'),u=undoStack.length?'':' disabled';
  if(view==='list'){m.innerHTML=`<div class="mrow"><button class="btn primary grow" data-act="wishadd">+ Añadir a la lista</button><button class="btn" data-act="toplan">Ver plano</button></div>`;return}
  if(mode==='room'){
    const f=selFixture(),o=selOpening(),x=f||o;
    if(!x){m.innerHTML=`<div class="mrow"><button class="btn primary grow" data-act="add">+ Añadir puerta, ventana…</button><button class="btn" data-act="undo"${u}>Deshacer</button><button class="btn" data-act="done">Listo</button></div><p class="note">Toca una puerta, ventana o elemento para moverlo. Las medidas están más abajo.</p>`;return}
    const wall=x.wall,hz=wall==='top'||wall==='bottom';
    const arrows=!wall?`<button data-act="l">◀</button><button data-act="u">▲</button><button data-act="d">▼</button><button data-act="r">▶</button>`:hz?`<button data-act="l" aria-label="Izquierda">◀</button><button data-act="r" aria-label="Derecha">▶</button>`:`<button data-act="u" aria-label="Arriba">▲</button><button data-act="d" aria-label="Abajo">▼</button>`;
    m.innerHTML=`<div class="mrow"><strong class="mname">${esc(f?fxLabel(f):opLabel(o))}</strong><span class="m">${f?f.len+'×'+f.depth:o.width+' cm'}</span><button class="btn" data-act="undo"${u} aria-label="Deshacer">↶</button><button class="btn" data-act="desel" aria-label="Terminar">✓</button></div>
    <div class="mrow"><div class="nudge" role="group" aria-label="Mover 1 cm">${arrows}</div><button class="btn grow" data-act="props">Medidas</button><button class="btn danger grow" data-act="del">Quitar</button></div>`;
    return;
  }
  const it=selItem();
  if(!it){m.innerHTML=`<div class="mrow"><button class="btn primary grow" data-act="add">+ Añadir mueble</button><button class="btn" data-act="undo"${u}>Deshacer</button></div><p class="note">Toca un mueble para moverlo, girarlo o quitarlo. Pellizca para acercar.</p>`;return}
  const stt=A.st.get(it.id);
  m.innerHTML=`<div class="mrow"><span class="dot ${stt||(it.kind==='floor'?'':'none')}"></span><strong class="mname">${esc(it.name)}</strong><span class="m">${it.w}×${it.d}</span><button class="btn" data-act="lock" aria-pressed="${it.locked}" aria-label="${it.locked?'Soltar':'Fijar'}" title="${it.locked?'Soltar':'Fijar'}">${it.locked?'🔒':'🔓'}</button><button class="btn" data-act="undo"${u} aria-label="Deshacer">↶</button><button class="btn" data-act="desel" aria-label="Terminar">✓</button></div>
  <div class="mrow"><div class="nudge" role="group" aria-label="Mover 1 cm"><button data-act="l" aria-label="Izquierda">◀</button><button data-act="u" aria-label="Arriba">▲</button><button data-act="d" aria-label="Abajo">▼</button><button data-act="r" aria-label="Derecha">▶</button></div><button class="btn grow" data-act="rot">Girar</button><button class="btn grow" data-act="dup">Copiar</button><button class="btn danger grow" data-act="del">Quitar</button></div>`;
}

let lastSel='__';
function renderAll(opts={}){
  const A=render();renderStatus(A);
  const key=mode+'|'+selId+'|'+(selFx?selFx.k+selFx.id:'');
  if(!opts.keepInspector||lastSel!==key)renderInspector();
  lastSel=key;
  renderHeader();renderMbar(A);
  $$('#snap button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.v===S.snap));
  $$('#modeSeg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===mode));
  $('#undo').disabled=!undoStack.length;
  if(view==='list')renderWish();
  if(view==='3d'&&T3.renderer)build3d();
}
