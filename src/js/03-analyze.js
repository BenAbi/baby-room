/* choques, avisos de seguridad del bebé y espacios de paso */
function blockers(R){
  const out=[];
  for(const f of R.fixtures){
    if(!fxMeta(f).soft)out.push({...fixRect(R,f),name:fxName(f),hard:1});
    const c=fixClear(R,f);if(c)out.push({...c,name:'la zona de apertura '+fxDe(f),hard:0});
  }
  return out;
}
const wallGap=(R,side,f)=>side==='top'?f.y:side==='bottom'?R.L-f.y-f.d:side==='left'?f.x:R.W-f.x-f.w;

function analyze(){
  const R=room(),items=cur().items,st=new Map(),warns=[],info=[];
  const mark=(id,l)=>{if(st.get(id)!=='err')st.set(id,l)};
  const fl=items.filter(i=>i.kind==='floor');
  for(let i=0;i<fl.length;i++)for(let j=i+1;j<fl.length;j++){
    const a=fl[i],b=fl[j];
    if(overlap(fp(a),fp(b))){mark(a.id,'err');mark(b.id,'err');warns.push({l:'err',t:`${a.name} y ${b.name} se solapan`,id:a.id})}
  }
  const obs=blockers(R),doors=R.openings.filter(o=>o.type==='door').map(o=>doorGeo(R,o));
  const rads=R.fixtures.filter(f=>f.type==='radiator').map(f=>fixRect(R,f));
  const wins=R.openings.filter(o=>o.type==='window');
  for(const a of fl){
    const f=fp(a);
    for(const o of obs)if(overlap(f,o)){
      if(o.hard){mark(a.id,'err');warns.push({l:'err',t:`${a.name} choca con ${o.name}`,id:a.id})}
      else{mark(a.id,'warn');warns.push({l:'warn',t:`${a.name} tapa ${o.name}`,id:a.id})}
    }
    if(doors.some(g=>hitsDoor(f,g))){mark(a.id,'warn');warns.push({l:'warn',t:`${a.name} está en el giro de la puerta`,id:a.id})}
    if(a.baby){
      for(const rad of rads){const dr=rdist(f,rad);if(!overlap(f,rad)&&dr<30){mark(a.id,'warn');warns.push({l:'warn',t:`${a.name} a ${Math.round(dr)} cm del radiador (mejor más de 30)`,id:a.id})}}
      for(const w of wins){
        const along=w.wall==='top'||w.wall==='bottom'?[f.x,f.x+f.w]:[f.y,f.y+f.d];
        if(wallGap(R,w.wall,f)<40&&along[0]<w.pos+w.width&&along[1]>w.pos){mark(a.id,'warn');warns.push({l:'warn',t:`${a.name} justo bajo la ventana (cordones, corrientes)`,id:a.id})}
      }
    }
  }
  // espacio de paso: huecos entre 20 cm y el mínimo configurado, sin nada en medio
  const minP=S.minPass||60;
  const solid=[...fl.map(i=>({r:fp(i),n:i.name,id:i.id})),...obs.filter(o=>o.hard&&o.y>=0&&o.x>=0&&o.y+o.d<=R.L&&o.x+o.w<=R.W).map(o=>({r:o,n:o.name}))];
  const free=(g,a,b)=>!solid.some(s=>s!==a&&s!==b&&overlap(s.r,g));
  const seen=new Set();
  for(let i=0;i<solid.length;i++){
    const a=solid[i];if(!a.id)continue;
    for(let j=0;j<solid.length;j++){
      if(i===j)continue;const b=solid[j],A=a.r,B=b.r,key=[i,j].sort().join('-');if(seen.has(key))continue;
      const oy=Math.min(A.y+A.d,B.y+B.d)-Math.max(A.y,B.y),ox=Math.min(A.x+A.w,B.x+B.w)-Math.max(A.x,B.x);
      let g=null,gr=null;
      if(oy>=30){const L=A.x<B.x?A:B,Rr=L===A?B:A;g=Rr.x-(L.x+L.w);gr={x:L.x+L.w,y:Math.max(A.y,B.y),w:g,d:oy}}
      else if(ox>=30){const T=A.y<B.y?A:B,Bt=T===A?B:A;g=Bt.y-(T.y+T.d);gr={x:Math.max(A.x,B.x),y:T.y+T.d,w:ox,d:g}}
      if(g!==null&&g>=20&&g<minP&&free(gr,a,b)){seen.add(key);info.push({l:'info',t:`Paso de ${Math.round(g)} cm entre ${a.n} y ${b.n}`,id:a.id,g:gr})}
    }
    for(const s of SIDES){
      const A=a.r,g=wallGap(R,s,A);if(!(g>=20&&g<minP))continue;
      const gr=s==='top'?{x:A.x,y:0,w:A.w,d:g}:s==='bottom'?{x:A.x,y:A.y+A.d,w:A.w,d:g}:s==='left'?{x:0,y:A.y,w:g,d:A.d}:{x:A.x+A.w,y:A.y,w:g,d:A.d};
      if(free(gr,a,null))info.push({l:'info',t:`Paso de ${Math.round(g)} cm entre ${a.n} y la ${R.labels[s]||DEFAULT_LABELS[s]}`,id:a.id,g:gr});
    }
  }
  return {st,warns,info};
}
