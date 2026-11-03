/* plano 2D en SVG (unidades = cm) */
const T=12; // grosor de pared dibujado
let mode='items';          // 'items' = mover muebles · 'room' = editar la habitación
let selId=null;            // mueble seleccionado
let selFx=null;            // {k:'fx'|'op', id} elemento de la habitación seleccionado
let Z={k:1,cx:null,cy:null};
let base={x:0,y:0,w:100,h:100};
const selItem=()=>cur().items.find(i=>i.id===selId);
const selFixture=()=>selFx&&selFx.k==='fx'?room().fixtures.find(f=>f.id===selFx.id):null;
const selOpening=()=>selFx&&selFx.k==='op'?room().openings.find(o=>o.id===selFx.id):null;

function margins(R){
  const m={top:T,right:T,bottom:T,left:T};
  for(const f of R.fixtures)if(f.wall&&f.inset)m[f.wall]=Math.max(m[f.wall],f.depth+4);
  for(const o of R.openings)if(o.type==='window')m[o.wall]=Math.max(m[o.wall],winDepth(R,o)+T);
  return m;
}
function applyZoom(){
  const svg=$('#plan');
  if(Z.k<=1.001){Z={k:1,cx:null,cy:null};svg.setAttribute('viewBox',`${base.x} ${base.y} ${base.w} ${base.h}`);return}
  const vw=base.w/Z.k,vh=base.h/Z.k;
  if(Z.cx===null){Z.cx=base.x+base.w/2;Z.cy=base.y+base.h/2}
  Z.cx=Math.min(Math.max(Z.cx,base.x+vw/2),base.x+base.w-vw/2);
  Z.cy=Math.min(Math.max(Z.cy,base.y+vh/2),base.y+base.h-vh/2);
  svg.setAttribute('viewBox',`${Z.cx-vw/2} ${Z.cy-vh/2} ${vw} ${vh}`);
}
function zoomBy(f,cx,cy){
  const k=Math.min(6,Math.max(1,Z.k*f));
  if(Z.cx===null){Z.cx=base.x+base.w/2;Z.cy=base.y+base.h/2}
  if(cx!==undefined){Z.cx=cx+(Z.cx-cx)*Z.k/k;Z.cy=cy+(Z.cy-cy)*Z.k/k}
  Z.k=k;applyZoom();
}

const R_=(r,cls,extra)=>`<rect x="${r1(r.x)}" y="${r1(r.y)}" width="${r1(r.w)}" height="${r1(r.d)}" class="${cls}"${extra||''}/>`;
function txt(R,side,a,o,str,size,cls){
  const p=wpt(R,side,a,o),rot=side==='left'?-90:side==='right'?90:0;
  return `<text transform="translate(${r1(p.x)} ${r1(p.y)})${rot?` rotate(${rot})`:''}" font-size="${size}" text-anchor="middle" class="${cls||'mlbl'}">${esc(str)}</text>`;
}

function render(){
  const svg=$('#plan'),R=room(),W=R.W,L=R.L,A=analyze(),m=margins(R),pad=32,edit=mode==='room';
  base={x:-m.left-pad,y:-m.top-pad-6,w:W+m.left+m.right+2*pad,h:L+m.top+m.bottom+2*pad+6};
  applyZoom();
  svg.classList.toggle('editing',edit);
  let h=`<defs>
  <pattern id="g10" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" class="gmin"/></pattern>
  <pattern id="g50" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#g10)"/><path d="M50 0H0V50" class="gmaj"/></pattern>
  <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" class="hatchl"/></pattern></defs>`;
  h+=`<rect x="${-T}" y="${-T}" width="${W+2*T}" height="${L+2*T}" class="wall"/>`;
  h+=`<rect x="0" y="0" width="${W}" height="${L}" class="floor"/><rect x="0" y="0" width="${W}" height="${L}" fill="url(#g50)"/>`;
  // huecos en la pared y ventanas
  for(const f of R.fixtures)if(f.wall&&f.inset)h+=R_(wrect(R,f.wall,f.pos-4,f.pos+f.len+4,0,f.depth+4),'wall');
  for(const o of R.openings)if(o.type==='window'){
    const dep=winDepth(R,o),hz=o.wall==='top'||o.wall==='bottom';
    h+=R_(wrect(R,o.wall,o.pos,o.pos+o.width,0,dep+T),'wall');
    h+=`<g class="op" data-op="${o.id}">`+R_(wrect(R,o.wall,o.pos,o.pos+o.width,dep+3,dep+T-3),'glass');
    const a=wpt(R,o.wall,o.pos,dep+T/2),b=wpt(R,o.wall,o.pos+o.width,dep+T/2);
    h+=`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="glassl"/>`;
    if(edit)h+=R_(wrect(R,o.wall,o.pos,o.pos+o.width,-8,dep+T),'ophit');
    h+=`</g>`;
    h+=txt(R,o.wall,o.pos+o.width/2,dep+T+(hz?3:5),`ventana ${o.width}`,6.5);
  }
  // puertas con su giro
  for(const o of R.openings)if(o.type==='door'){
    const g=doorGeo(R,o),P=g.P,E=wpt(R,o.wall,o.hinge==='end'?o.pos:o.pos+o.width,0);
    const inward={top:[0,1],bottom:[0,-1],left:[1,0],right:[-1,0]}[o.wall],O={x:P.x+inward[0]*g.R,y:P.y+inward[1]*g.R};
    const v1x=E.x-P.x,v1y=E.y-P.y,v2x=O.x-P.x,v2y=O.y-P.y,sw=v1x*v2y-v1y*v2x>0?1:0;
    h+=`<g class="op" data-op="${o.id}">`+R_(wrect(R,o.wall,o.pos,o.pos+o.width,0,T),'floor');
    h+=`<path d="M${P.x} ${P.y} L${E.x} ${E.y} A${g.R} ${g.R} 0 0 ${sw} ${O.x} ${O.y} Z" class="doorarc"/>`;
    h+=`<line x1="${P.x}" y1="${P.y}" x2="${O.x}" y2="${O.y}" class="doorleaf"/>`;
    if(edit)h+=R_(wrect(R,o.wall,o.pos,o.pos+o.width,-Math.min(30,o.width/2),T),'ophit');
    h+=`</g>`;
  }
  // elementos fijos
  for(const f of R.fixtures){
    const r=fixRect(R,f),c=fixClear(R,f),hz=f.wall==='top'||f.wall==='bottom'||!f.wall;
    if(c)h+=R_(c,'zone');
    h+=`<g class="fx" data-fx="${f.id}">`;
    if(f.type==='radiator'){
      h+=R_(r,'rad');
      if(hz)for(let x=r.x+5;x<r.x+r.w;x+=5)h+=`<line x1="${r1(x)}" x2="${r1(x)}" y1="${r1(r.y+2)}" y2="${r1(r.y+r.d-2)}" class="hatchl"/>`;
      else for(let y=r.y+5;y<r.y+r.d;y+=5)h+=`<line y1="${r1(y)}" y2="${r1(y)}" x1="${r1(r.x+2)}" x2="${r1(r.x+r.w-2)}" class="hatchl"/>`;
    }else if(f.type==='column'){
      h+=R_(r,'fixed')+R_(r,'','  fill="url(#hatch)"');
    }else if(f.type==='niche'){
      h+=R_(r,'niche');
    }else{
      h+=R_(r,'fixed');
      const cx=r.x+r.w/2,cy=r.y+r.d/2,big=Math.max(r.w,r.d)>=60&&Math.min(r.w,r.d)>=24,rot=r.d>r.w*1.3?` transform="rotate(-90 ${r1(cx)} ${r1(cy)})"`:'';
      if(big)h+=`<g${rot}><text x="${r1(cx)}" y="${r1(cy-1)}" font-size="8" text-anchor="middle" class="flbl">${esc(fxLabel(f))}</text><text x="${r1(cx)}" y="${r1(cy+9)}" font-size="6.5" text-anchor="middle" class="mlbl">${f.len} × ${f.depth}</text></g>`;
    }
    if(edit)h+=R_({x:r.x-2,y:r.y-2,w:r.w+4,d:r.d+4},'ophit');
    h+=`</g>`;
  }
  // lámpara de techo
  if(R.lamp)h+=`<g opacity=".8"><circle cx="${W/2}" cy="${L/2}" r="5" class="lamp"/><path d="M${W/2-8} ${L/2}h16M${W/2} ${L/2-8}v16" class="lamp"/></g>`;
  // cotas exteriores y nombres de las paredes
  const lb=R.labels||DEFAULT_LABELS;
  h+=`<path d="M0 ${-m.top-14}H${W}M0 ${-m.top-18}v8M${W} ${-m.top-18}v8" class="mline"/><text x="${W/2}" y="${-m.top-18}" font-size="8" text-anchor="middle" class="mlbl">${W} cm · ${esc(lb.top)}</text>`;
  h+=`<path d="M${-m.left-14} 0V${L}M${-m.left-18} 0h8M${-m.left-18} ${L}h8" class="mline"/><text transform="translate(${-m.left-18} ${L/2}) rotate(-90)" font-size="8" text-anchor="middle" class="mlbl">${L} cm · ${esc(lb.left)}</text>`;
  h+=`<text x="${W/2}" y="${L+m.bottom+11}" font-size="8" text-anchor="middle" class="mlbl">${esc(lb.bottom)}</text>`;
  h+=`<text transform="translate(${W+m.right+14} ${L/2}) rotate(90)" font-size="8" text-anchor="middle" class="mlbl">${esc(lb.right)}</text>`;
  // muebles
  const order={overlay:0,floor:1,wall:2,ceiling:3};
  const items=[...cur().items].sort((a,b)=>order[a.kind]-order[b.kind]||(a.id===selId)-(b.id===selId));
  for(const it of items){
    const f=fp(it),stt=A.st.get(it.id),cx=f.x+f.w/2,cy=f.y+f.d/2;
    h+=`<g class="item k-${it.kind}${stt?' st-'+stt:''}${it.id===selId&&!edit?' sel':''}${it.locked?' locked':''}" data-id="${it.id}">`;
    h+=it.shape==='round'
      ?`<ellipse cx="${cx}" cy="${cy}" rx="${f.w/2}" ry="${f.d/2}" class="body" style="fill:var(--i-${it.color})"/>`
      :`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.d}" rx="1.5" class="body" style="fill:var(--i-${it.color})"/>`;
    if(it.kind!=='wall'){
      const vert=f.d>f.w*1.3,long=vert?f.d:f.w,short=vert?f.w:f.d;
      let fs=Math.max(5,Math.min(9,short/5));
      if(it.name.length*fs*.56>long-6)fs=Math.max(4.5,(long-6)/(it.name.length*.56));
      const dims=`${it.w}×${it.d}`,showName=short>=fs*2.6&&it.name.length*fs*.56<=long-4;
      const tr=vert?` transform="rotate(-90 ${cx} ${cy})"`:'';
      if(showName)h+=`<g${tr}><text class="lbl" x="${cx}" y="${cy-fs*.15}" font-size="${fs}" text-anchor="middle">${esc(it.name)}</text><text class="lbld" x="${cx}" y="${cy+fs*.95}" font-size="${fs*.85}" text-anchor="middle">${dims}</text></g>`;
      else if(short>=8&&dims.length*5*.6<=long)h+=`<g${tr}><text class="lbld" x="${cx}" y="${cy+2}" font-size="5" text-anchor="middle">${dims}</text></g>`;
    }
    if(it.locked)h+=`<g class="lockic" transform="translate(${f.x+f.w-8} ${f.y+3})"><rect x="0" y="3" width="6" height="4.5" rx=".8"/><path d="M1.2 3V1.8a1.8 1.8 0 0 1 3.6 0V3" fill="none"/></g>`;
    h+=`</g>`;
  }
  // huecos de paso estrechos del seleccionado
  if(!edit&&selId)for(const x of A.info)if(x.id===selId&&x.g)h+=R_(x.g,'gapz');
  // cotas del seleccionado: distancia al obstáculo más cercano en cada dirección
  const it=selItem();
  if(it&&!edit)h+=cotas(it,R);
  // selección en el modo habitación
  if(edit){
    const f=selFixture(),o=selOpening();
    if(f){const r=fixRect(R,f);h+=R_({x:r.x-3,y:r.y-3,w:r.w+6,d:r.d+6},'fxsel')}
    if(o){const dep=o.type==='window'?winDepth(R,o):0;h+=R_(wrect(R,o.wall,o.pos-(o.frame||0),o.pos+o.width+(o.frame||0),-3,dep+T+3),'fxsel')}
  }
  svg.innerHTML=h;
  return A;
}

function cotas(it,R){
  const f=fp(it),W=R.W,L=R.L;
  const others=it.kind==='floor'?[...cur().items.filter(i=>i.kind==='floor'&&i.id!==it.id).map(fp),...blockers(R).filter(o=>o.hard)]:[];
  const ys=b=>Math.min(b.y+b.d,f.y+f.d)-Math.max(b.y,f.y),xs=b=>Math.min(b.x+b.w,f.x+f.w)-Math.max(b.x,f.x);
  const best=(cands,wallGap)=>{let g=wallGap,b=null;for(const c of cands)if(c.g<g){g=c.g;b=c.b}return{g,b}};
  const my=f.y+f.d/2,mx=f.x+f.w/2;
  const L_=best(others.filter(b=>ys(b)>0&&b.x+b.w<=f.x+.5).map(b=>({b,g:f.x-(b.x+b.w)})),f.x);
  const R_g=best(others.filter(b=>ys(b)>0&&b.x>=f.x+f.w-.5).map(b=>({b,g:b.x-(f.x+f.w)})),W-f.x-f.w);
  const U=best(others.filter(b=>xs(b)>0&&b.y+b.d<=f.y+.5).map(b=>({b,g:f.y-(b.y+b.d)})),f.y);
  const D=best(others.filter(b=>xs(b)>0&&b.y>=f.y+f.d-.5).map(b=>({b,g:b.y-(f.y+f.d)})),L-f.y-f.d);
  const midY=b=>b?(Math.max(b.y,f.y)+Math.min(b.y+b.d,f.y+f.d))/2:my,midX=b=>b?(Math.max(b.x,f.x)+Math.min(b.x+b.w,f.x+f.w))/2:mx;
  const seg=(x1,y1,x2,y2,v,tx,ty)=>v<1?'':`<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" class="dim"/><text x="${r1(tx)}" y="${r1(ty)}" font-size="7.5" text-anchor="middle" class="dimt">${r1(v)}</text>`;
  let h='';
  let y=midY(L_.b);h+=seg(f.x-L_.g,y,f.x,y,L_.g,f.x-L_.g/2,y-3);
  y=midY(R_g.b);h+=seg(f.x+f.w,y,f.x+f.w+R_g.g,y,R_g.g,f.x+f.w+R_g.g/2,y-3);
  let x=midX(U.b);h+=seg(x,f.y-U.g,x,f.y,U.g,x+1,f.y-U.g/2+3);
  x=midX(D.b);h+=seg(x,f.y+f.d,x,f.y+f.d+D.g,D.g,x+1,f.y+f.d+D.g/2+3);
  return h;
}
