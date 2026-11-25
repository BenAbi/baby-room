/* Planos (detrás de BAS): cada usuario tiene sus proyectos en el servidor, con guardado automático,
   y puede compartirlos con otros usuarios de BAS («puede editar» o «solo ver»).
   Si dos personas guardan a la vez, el servidor responde 409 y aquí se carga la versión más reciente. */
const PL={id:null,version:0,permiso:null,nombre:'',dueno:null,lista:[],yo:null,guardado:'',pendiente:false,enVuelo:false,timer:0,compartirId:null,renombrar:null};
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const PERM_TXT={dueno:'',editar:'puede editar',ver:'solo ver'};

async function papi(metodo,ruta,cuerpo,crudo){
  const opt={method:metodo,credentials:'same-origin',cache:'no-store',headers:{}};
  if(cuerpo!==undefined||crudo!==undefined){opt.headers['Content-Type']='application/json';opt.body=crudo!==undefined?crudo:JSON.stringify(cuerpo)}
  let r;
  try{r=await fetch('api/'+ruta,opt)}catch(e){const er=new Error('Sin conexión con Planos. Se volverá a intentar.');er.estado=0;throw er}
  let d=null;try{d=await r.json()}catch(e){}
  if(r.status===401){location.href='../?volver='+encodeURIComponent(location.pathname+location.search);throw new Error('Inicia sesión en BAS.')}
  if(!r.ok){const e=new Error((d&&d.error)||'Planos no ha podido hacerlo.');e.estado=r.status;e.datos=d;throw e}
  return d;
}

function aviso(t,err){const a=$('#pAviso');a.hidden=!t;a.textContent=t||'';a.classList.toggle('err',!!err)}
function estadoGuardado(st,t){
  const p=$('#pSave'),m={ok:['ok','Guardado'],pendiente:['warn','Guardando…'],ver:['warn','Solo ver'],error:['err','Sin guardar'],nuevo:['warn','Sin plano']}[st];
  p.className='pill '+m[0];p.textContent=m[1];p.title=t||'';
}
function plano(){
  $('#pName').textContent=PL.nombre||'Elige un plano';
  $('#pPerm').textContent=PL.permiso&&PL.permiso!=='dueno'?`de ${PL.dueno.nombre} · ${PERM_TXT[PL.permiso]}`:'';
  document.title=(PL.nombre?PL.nombre+' · ':'')+'Planos';
}

/* guardado automático */
function basSave(){
  if(!PL.id)return;
  if(JSON.stringify(S)===PL.guardado)return;
  if(PL.permiso==='ver'){estadoGuardado('ver','Solo puedes ver este plano: los cambios no se guardan.');return}
  PL.pendiente=true;estadoGuardado('pendiente');
  clearTimeout(PL.timer);PL.timer=setTimeout(basFlush,700);
}
async function basFlush(){
  clearTimeout(PL.timer);
  if(!PL.id||PL.permiso==='ver')return;
  if(PL.enVuelo){PL.timer=setTimeout(basFlush,300);return}
  const txt=JSON.stringify(S);
  if(txt===PL.guardado){PL.pendiente=false;estadoGuardado('ok');return}
  PL.enVuelo=true;
  try{
    const r=await papi('PUT','proyectos/'+PL.id,undefined,`{"version":${PL.version},"datos":${txt}}`);
    PL.version=r.version;PL.guardado=txt;
  }catch(e){
    PL.enVuelo=false;
    if(e.estado===409){const ed=e.datos&&e.datos.editadoPor;await cargarUltima(ed&&ed.usuario===PL.yo.usuario?'Has cambiado este plano desde otra pestaña o dispositivo. Se ha cargado esa versión; tu último cambio aquí no se ha guardado.':`${ed?ed.nombre:'Otra persona'} cambió este plano a la vez que tú. Se ha cargado su versión; tu último cambio no se ha guardado.`);return}
    if(e.estado===403){PL.permiso='ver';plano();estadoGuardado('ver');aviso('Ahora solo puedes ver este plano: los cambios no se guardan.');return}
    if(e.estado===404){perdido();return}
    estadoGuardado('error',e.message);aviso(e.message,true);
    PL.timer=setTimeout(basFlush,5000);return;
  }
  PL.enVuelo=false;
  if(JSON.stringify(S)!==PL.guardado){PL.timer=setTimeout(basFlush,300);return}
  PL.pendiente=false;estadoGuardado('ok');
  if($('#pAviso').classList.contains('err'))aviso('');
}
function aplicar(p){
  PL.id=p.id;PL.version=p.version;PL.permiso=p.permiso;PL.nombre=p.nombre;PL.dueno=p.dueno;
  S=upgrade(p.datos);PL.guardado=JSON.stringify(S);PL.pendiente=false;
  plano();estadoGuardado(PL.permiso==='ver'?'ver':'ok');
}
async function cargarUltima(texto){
  try{
    const p=await papi('GET','proyectos/'+PL.id);
    aplicar(p);selId=null;selFx=null;undoStack=[];renderCatalog();renderAll();
    if(texto)aviso(texto);
  }catch(e){if(e.estado===404)perdido();else aviso(e.message,true)}
}
function perdido(){
  PL.id=null;PL.pendiente=false;estadoGuardado('nuevo');
  aviso('Este plano ya no está disponible: lo han borrado o han dejado de compartirlo contigo.',true);
  abrirLista();
}
// cada 15 s, si no hay cambios por guardar, mira si alguien más ha guardado
async function vigilar(){
  if(!PL.id||document.hidden||PL.pendiente||PL.enVuelo)return;
  try{
    const v=await papi('GET','proyectos/'+PL.id+'?version');
    if(v.permiso!==PL.permiso){PL.permiso=v.permiso;plano();estadoGuardado(v.permiso==='ver'?'ver':'ok')}
    if(v.version>PL.version&&!PL.pendiente&&!PL.enVuelo)await cargarUltima(`Plano actualizado con los cambios de ${v.editadoPor?v.editadoPor.nombre:'otra persona'}.`);
  }catch(e){if(e.estado===404)perdido()}
}

/* lista de proyectos */
function abrir(id){
  const ir=()=>{location.search='?p='+encodeURIComponent(id)};
  if(PL.pendiente||PL.enVuelo){basFlush().finally(ir)}else ir();
}
async function refrescarLista(){PL.lista=await papi('GET','proyectos');pintarLista()}
function pintarLista(){
  const hay=PL.lista.length;
  $('#pIntro').textContent=hay?'Tus planos y los que otras personas han compartido contigo.':`Hola, ${PL.yo.nombre}. Todavía no tienes ningún plano: crea uno abajo.`;
  $('#pClose').hidden=!PL.id;
  $('#pList').innerHTML=PL.lista.map(p=>{
    const mio=p.permiso==='dueno',on=p.id===PL.id;
    const det=mio?(p.compartidos.length?`Tuyo · compartido con ${p.compartidos.length===1?'1 persona':p.compartidos.length+' personas'}`:'Tuyo'):`De ${esc(p.dueno.nombre)} · ${PERM_TXT[p.permiso]}`;
    const fecha=new Date(p.actualizado).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'});
    const nombre=PL.renombrar===p.id?`<input data-rn="${p.id}" value="${esc(p.nombre)}" maxlength="80" aria-label="Nuevo nombre">`:`<b>${esc(p.nombre)}</b>`;
    const bot=[
      on?'<span class="note">Abierto</span>':`<button class="btn primary" data-pa="${p.id}" type="button">Abrir</button>`,
      mio?`<button class="btn" data-pr="${p.id}" type="button">${PL.renombrar===p.id?'Guardar nombre':'Renombrar'}</button>`:'',
      mio?`<button class="btn" data-ps="${p.id}" type="button" aria-pressed="${PL.compartirId===p.id}">Compartir</button>`:'',
      `<button class="btn danger" data-pd="${p.id}" type="button">${mio?'Borrar':'Dejar de ver'}</button>`
    ].join('');
    return `<li class="${on?'on':''}"><div class="pn">${nombre}<span>${det} · ${fecha}</span></div><div class="btnrow">${bot}</div></li>`;
  }).join('');
  $$('#pList [data-pd]').forEach(b=>armed(b,()=>borrar(b.dataset.pd)));
  const rn=$('#pList [data-rn]');if(rn){rn.focus();rn.select()}
  pintarCompartir();
}
function pintarCompartir(){
  const p=PL.lista.find(x=>x.id===PL.compartirId&&x.permiso==='dueno');
  $('#pShare').hidden=!p;if(!p)return;
  $('#pShareTitle').textContent=`Compartir «${p.nombre}»`;
  $('#pShareList').innerHTML=p.compartidos.length?p.compartidos.map(c=>`<li><div class="pn"><b>${esc(c.nombre||c.usuario)}</b><span>@${esc(c.usuario)}${c.nombre?'':' · todavía no ha entrado en Planos'}</span></div>
    <div class="btnrow"><select data-cp="${esc(c.usuario)}" aria-label="Permiso de ${esc(c.usuario)}"><option value="editar"${c.permiso==='editar'?' selected':''}>Puede editar</option><option value="ver"${c.permiso==='ver'?' selected':''}>Solo ver</option></select>
    <button class="btn danger" data-cq="${esc(c.usuario)}" type="button">Quitar acceso</button></div></li>`).join(''):'<li class="note">Aún no lo has compartido con nadie.</li>';
  $$('#pShareList [data-cq]').forEach(b=>armed(b,()=>quitar(p.id,b.dataset.cq)));
}
const pmsg=t=>{$('#pMsg').textContent=t||''};
const smsg=t=>{$('#pShareMsg').textContent=t||''};
function abrirLista(){pintarLista();const d=$('#pDlg');if(!d.open)d.showModal()}

async function borrar(id){
  const p=PL.lista.find(x=>x.id===id);
  try{
    await papi('DELETE','proyectos/'+id);
    if(PL.compartirId===id)PL.compartirId=null;
    await refrescarLista();
    pmsg(p.permiso==='dueno'?`«${p.nombre}» borrado.`:`Ya no verás «${p.nombre}».`);
    if(id===PL.id){PL.id=null;estadoGuardado('nuevo');if(PL.lista[0])abrir(PL.lista[0].id);else{PL.nombre='';plano();pintarLista()}}
  }catch(e){pmsg(e.message)}
}
async function renombrar(id,nombre){
  try{const r=await papi('PATCH','proyectos/'+id,{nombre});PL.renombrar=null;if(id===PL.id){PL.nombre=r.nombre;plano()}await refrescarLista()}
  catch(e){pmsg(e.message)}
}
async function compartir(id,usuario,permiso){
  try{
    const r=await papi('POST',`proyectos/${id}/compartir`,{usuario,permiso});
    await refrescarLista();
    smsg(r.haEntrado?`Hecho: @${usuario.replace(/^@/,'').toLowerCase()} ya lo tiene en su lista de Planos.`:`Hecho. Lo verá en su lista cuando entre en Planos (necesita permiso de Planos en BAS).`);
    return true;
  }catch(e){smsg(e.message);return false}
}
async function quitar(id,usuario){
  try{await papi('DELETE',`proyectos/${id}/compartir/${encodeURIComponent(usuario)}`);await refrescarLista();smsg(`@${usuario} ya no tiene acceso.`)}
  catch(e){smsg(e.message)}
}
function datosVacios(){
  const R=blankRoom('Habitación 1',300,300);R.active=R.layouts[0].id;
  return {v:4,rooms:[R],roomId:R.id,snap:5,minPass:60,custom:[],wishlist:[],seeds:['ce']};
}
async function crear(nombre,datos){
  try{const p=await papi('POST','proyectos',{nombre,datos});abrir(p.id)}
  catch(e){pmsg(e.message)}
}
function datosDeCopia(d){
  if(d&&d.data&&d.data.rooms)return upgrade(d.data);
  if(d&&d.rooms)return upgrade(d);
  if(d&&d.layouts&&d.room)return fromV1(d);
  return null;
}

function basStart(start){
  $('#pOpen').addEventListener('click',()=>{refrescarLista().catch(()=>{});abrirLista()});
  $('#pClose').addEventListener('click',()=>$('#pDlg').close());
  $('#pDlg').addEventListener('cancel',e=>{if(!PL.id)e.preventDefault()});
  $('#pList').addEventListener('click',e=>{
    const a=e.target.closest('[data-pa]');if(a){abrir(a.dataset.pa);return}
    const r=e.target.closest('[data-pr]');
    if(r){if(PL.renombrar===r.dataset.pr){renombrar(r.dataset.pr,$('#pList [data-rn]').value)}else{PL.renombrar=r.dataset.pr;pintarLista()}return}
    const s=e.target.closest('[data-ps]');if(s){PL.compartirId=PL.compartirId===s.dataset.ps?null:s.dataset.ps;smsg('');pintarLista();if(PL.compartirId)$('#pShareUser').focus()}
  });
  $('#pList').addEventListener('keydown',e=>{
    const i=e.target.closest('[data-rn]');if(!i)return;
    if(e.key==='Enter'){e.preventDefault();renombrar(i.dataset.rn,i.value)}
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();PL.renombrar=null;pintarLista()}
  });
  $('#pShareList').addEventListener('change',e=>{const s=e.target.closest('[data-cp]');if(s)compartir(PL.compartirId,s.dataset.cp,s.value)});
  $('#pShareForm').addEventListener('submit',async e=>{
    e.preventDefault();const u=$('#pShareUser');
    if(await compartir(PL.compartirId,u.value.trim(),$('#pShareLevel').value))u.value='';
  });
  $('#pNewForm').addEventListener('submit',e=>{
    e.preventDefault();
    crear($('#pNewName').value.trim(),datosVacios());
  });
  $('#pNewFile').addEventListener('change',e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{let d;try{d=datosDeCopia(JSON.parse(rd.result))}catch(er){d=null}
      if(!d){pmsg('El archivo no contiene datos del planificador.');return}
      crear(f.name.replace(/\.json$/i,'').slice(0,80)||'Copia restaurada',d)};
    rd.readAsText(f);
  });
  // Nada de datos comunes: ni el plano guardado en este navegador (en un dispositivo compartido puede ser de
  // otra persona) ni el ejemplo de la familia. Cada usuario ve solo sus planos y los que le compartan.
  $('#roomTitle').textContent='';$('#roomsub').textContent='';
  const nota=$('#fileDetails .note');if(nota)nota.textContent='Se guarda solo en Planos, dentro de BAS. Puedes descargar una copia de vez en cuando.';
  $('#fileDetails summary').textContent='Copias, imágenes e impresión';

  addEventListener('beforeunload',e=>{if(PL.pendiente||PL.enVuelo){basFlush();e.preventDefault()}});
  addEventListener('pagehide',()=>{
    if(!PL.pendiente||PL.enVuelo||!PL.id||PL.permiso==='ver')return;
    const txt=JSON.stringify(S);if(txt===PL.guardado)return;
    try{fetch('api/proyectos/'+PL.id,{method:'PUT',keepalive:true,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:`{"version":${PL.version},"datos":${txt}}`})}catch(e){}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)vigilar()});
  setInterval(vigilar,15000);

  (async()=>{
    try{
      PL.yo=await papi('GET','yo');
      $('#pUser').textContent=PL.yo.nombre;
      PL.lista=await papi('GET','proyectos');
    }catch(e){aviso(e.message,true);estadoGuardado('error');start(datosVacios());return}
    const ultimoK='planos-ultimo-'+PL.yo.usuario;
    const pedido=new URLSearchParams(location.search).get('p');
    const elegido=PL.lista.find(p=>p.id===pedido)||PL.lista.find(p=>p.id===lsGet(ultimoK))||PL.lista[0];
    if(pedido&&(!elegido||elegido.id!==pedido))aviso('Ese plano ya no está disponible: lo han borrado o han dejado de compartirlo contigo.',true);
    if(!elegido){
      plano();estadoGuardado('nuevo');start(datosVacios());
      $('#pNewName').value='Mi casa';abrirLista();return;
    }
    try{
      const p=await papi('GET','proyectos/'+elegido.id);
      aplicar(p);lsSet(ultimoK,p.id);
      history.replaceState(null,'','?p='+encodeURIComponent(p.id));
      if(p.permiso==='ver')aviso(`Solo puedes ver este plano de ${p.dueno.nombre}: los cambios que hagas no se guardan.`);
      start(S);
    }catch(e){aviso(e.message,true);estadoGuardado('error');start(datosVacios())}
  })();
}
