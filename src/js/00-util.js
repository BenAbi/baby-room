/* utilidades comunes */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r1=v=>Math.round(v*10)/10;
const lc1=s=>s.charAt(0).toLowerCase()+s.slice(1);
const clone=o=>JSON.parse(JSON.stringify(o));
const isPhone=()=>window.matchMedia('(max-width:760px)').matches;
const eur=n=>(+n||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
const safeLink=u=>/^https?:\/\//i.test(String(u||'').trim())?String(u).trim():'';
let uidN=Date.now()%100000;
const uid=(p='i')=>p+(uidN++).toString(36);

// botón que pide una segunda pulsación antes de una acción destructiva
function armed(btn,fn){
  if(!btn)return;
  const label=btn.textContent;
  btn.addEventListener('click',()=>{
    if(btn.classList.contains('armed')){btn.classList.remove('armed');btn.textContent=label;fn();return}
    btn.classList.add('armed');btn.textContent='¿Seguro? Pulsa otra vez';
    setTimeout(()=>{btn.classList.remove('armed');btn.textContent=label},3500);
  });
}

function download(name,blob){
  const u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),5000);
}
const today=()=>new Date().toISOString().slice(0,10);
