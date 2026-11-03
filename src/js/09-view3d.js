/* vista 3D: isométrica (con paredes recortadas) o a pie, con muebles que se pueden tocar y arrastrar */
let THREE=null,OrbitControls=null,corner=0,walk=false;
const T3={mats:{},itemObjs:[]};
const HEX={rose:0xE7A6BA,sand:0xD9BF8E,sage:0xA9CBA9,sky:0xA9C7E6,lilac:0xB9A8DE,stone:0xC6C2B9};
const C3={wall:0xF2EFEA,white:0xF5F5F2,wood:0xD9C39E,woodDark:0xC9AF86,dark:0x2E3035,frame:0x7A3B2A,glass:0xA9D3EE,foam:0xBDB7AF,stub:0xB9B2A8,handle:0x8E8A84,accent:0xB4486B};
async function ensureThree(){
  if(THREE)return;
  const m=await import('three'),c=await import('three/addons/controls/OrbitControls.js');
  THREE=m;OrbitControls=c.OrbitControls;
}
function init3d(){
  if(T3.renderer)return;
  const el=$('#canvas3d');
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true});
  r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));el.appendChild(r.domElement);
  const scene=new THREE.Scene();
  const iso={cam:new THREE.OrthographicCamera(-1,1,1,-1,-5000,5000)};
  iso.ctr=new OrbitControls(iso.cam,r.domElement);
  Object.assign(iso.ctr,{enableDamping:true,maxPolarAngle:Math.PI/2.1,minZoom:.6,maxZoom:5});
  const fpv={cam:new THREE.PerspectiveCamera(64,1,1,5000)};
  fpv.ctr=new OrbitControls(fpv.cam,r.domElement);
  Object.assign(fpv.ctr,{enableDamping:true,enableZoom:false,enablePan:false,rotateSpeed:-.35,minPolarAngle:.35,maxPolarAngle:Math.PI-.35,enabled:false});
  scene.add(new THREE.HemisphereLight(0xffffff,0xa89c8c,3));
  const sun=new THREE.DirectionalLight(0xffffff,1.4);sun.position.set(-200,500,-350);scene.add(sun);
  const fill=new THREE.DirectionalLight(0xffffff,.55);fill.position.set(300,200,400);scene.add(fill);
  Object.assign(T3,{renderer:r,scene,iso,fp:fpv,active:iso});
  iso.ctr.addEventListener('change',cutaway);
  if(window.ResizeObserver)new ResizeObserver(resize3d).observe(el);
  el.addEventListener('pointerdown',down3d,true); // fase de captura: antes que los controles de cámara
  window.addEventListener('pointermove',move3d);
  window.addEventListener('pointerup',up3d);window.addEventListener('pointercancel',up3d);
  (function loop(){requestAnimationFrame(loop);if(view!=='3d')return;T3.active.ctr.update();r.render(scene,T3.active.cam)})();
}
function resize3d(){
  if(!T3.renderer)return;
  const el=$('#canvas3d'),w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;
  T3.renderer.setSize(w,h,false);
  const R=room(),vs=(R.W+R.L)*.78,a=w/h,c=T3.iso.cam;
  if(a>=1){c.left=-vs*a/2;c.right=vs*a/2;c.top=vs/2;c.bottom=-vs/2}
  else{c.left=-vs/2;c.right=vs/2;c.top=vs/a/2;c.bottom=-vs/a/2}
  c.updateProjectionMatrix();
  T3.fp.cam.aspect=a;T3.fp.cam.updateProjectionMatrix();
}
function isoView(){
  const R=room(),H=R.H||250,[sx,sz]=[[1,1],[-1,1],[-1,-1],[1,-1]][corner];
  T3.iso.ctr.target.set(R.W/2,H*.3,R.L/2);
  T3.iso.cam.position.set(R.W/2+sx*1000,H*.3+880,R.L/2+sz*1000);
  T3.iso.cam.zoom=1;T3.iso.cam.updateProjectionMatrix();T3.iso.ctr.update();cutaway();
}
function cutaway(){
  if(!T3.walls)return;
  if(walk){Object.values(T3.walls).forEach(w=>w.visible=true);if(T3.ceiling)T3.ceiling.visible=true;return}
  if(T3.ceiling)T3.ceiling.visible=false;
  const v=T3.iso.cam.position.clone().sub(T3.iso.ctr.target);
  T3.walls.top.visible=!(v.z<-1);T3.walls.bottom.visible=!(v.z>1);
  T3.walls.left.visible=!(v.x<-1);T3.walls.right.visible=!(v.x>1);
}
function walkStart(){
  const R=room(),d=R.openings.find(o=>o.type==='door');
  let p={x:R.W/2,y:R.L-40};
  if(d){const inw={top:[0,1],bottom:[0,-1],left:[1,0],right:[-1,0]}[d.wall],q=wpt(R,d.wall,d.pos+d.width/2,0);p={x:q.x+inw[0]*45,y:q.y+inw[1]*45}}
  return p;
}
function setWalk(on){
  if(!T3.renderer)return;
  walk=on;
  const b=$('#walk3d');b.textContent=on?'Vista aérea':'Vista a pie';b.setAttribute('aria-pressed',on);
  $('#rot3d').hidden=on;
  T3.iso.ctr.enabled=!on;T3.fp.ctr.enabled=on;T3.active=on?T3.fp:T3.iso;
  if(on){
    const R=room(),p=walkStart(),c=T3.fp.cam,eye=158;
    c.position.set(p.x,eye,p.y);
    const dir=new THREE.Vector3(R.W/2-p.x,120-eye,R.L/2-p.y).normalize();
    T3.fp.ctr.target.copy(c.position).add(dir);T3.fp.ctr.update();
  }
  cutaway();resize3d();msg3d();
}
function walkTo(p){
  const R=room(),c=T3.fp.cam,t=T3.fp.ctr.target,dir=t.clone().sub(c.position);
  c.position.set(Math.min(Math.max(p.x,25),R.W-25),c.position.y,Math.min(Math.max(p.z,25),R.L-25));
  t.copy(c.position).add(dir);T3.fp.ctr.update();
}
function msg3d(){$('#msg3d').textContent=walk?'Arrastra para mirar alrededor · toca el suelo para caminar hasta allí':'Arrastra un mueble para moverlo · arrastra el fondo para girar · rueda o pellizco para acercar'}

/* tocar y arrastrar muebles en 3D */
function ndc(e){const b=T3.renderer.domElement.getBoundingClientRect();return new THREE.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1)}
function ray(e){const rc=new THREE.Raycaster();rc.setFromCamera(ndc(e),T3.active.cam);return rc}
function pick(e){
  for(const h of ray(e).intersectObjects(T3.itemObjs,true)){let o=h.object;while(o&&!o.userData.id)o=o.parent;if(o&&o.visible)return o}
  return null;
}
function floorAt(e){const p=new THREE.Vector3();return ray(e).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),p)?p:null}
function down3d(e){
  if(e.button>0||!T3.renderer)return;
  const o=pick(e);T3.down={x:e.clientX,y:e.clientY,id:o&&o.userData.id,pid:e.pointerId};
  if(!o||walk||mode!=='items')return;
  const it=cur().items.find(i=>i.id===o.userData.id),p=floorAt(e);
  if(!it||it.locked||!p)return;
  T3.drag={it,obj:o,ox:p.x-it.x,oz:p.z-it.y,snap:JSON.stringify(S),moved:false};
  T3.active.ctr.enabled=false;
}
function move3d(e){
  const d=T3.drag;if(!d||!T3.down||e.pointerId!==T3.down.pid)return;
  if(!d.moved&&Math.hypot(e.clientX-T3.down.x,e.clientY-T3.down.y)<5)return;
  const p=floorAt(e);if(!p)return;
  const sn=S.snap||1,it=d.it,nx=Math.round((p.x-d.ox)/sn)*sn,ny=Math.round((p.z-d.oz)/sn)*sn;
  if(nx===it.x&&ny===it.y)return;
  it.x=nx;it.y=ny;clampItem(it);d.moved=true;
  const f=fp(it);d.obj.position.set(f.x+f.w/2,0,f.y+f.d/2);
  renderStatus(render());
}
function up3d(e){
  const dn=T3.down;if(!dn||e.pointerId!==dn.pid)return;
  T3.down=null;
  const d=T3.drag;T3.drag=null;
  if(T3.renderer)T3.active.ctr.enabled=true;
  if(d&&d.moved){selId=d.it.id;pushUndo(d.snap);save();renderAll();return}
  if(Math.hypot(e.clientX-dn.x,e.clientY-dn.y)>5)return; // fue un giro de cámara
  if(dn.id){if(mode!=='items')setMode('items');select(dn.id);return}
  if(walk){const p=floorAt(e);if(p)walkTo(p);return}
  if(selId)select(null);
}

/* piezas básicas */
function mat(c,o){const k=c+'|'+(o||1);return T3.mats[k]||(T3.mats[k]=new THREE.MeshLambertMaterial({color:c,transparent:!!o,opacity:o||1}))}
function edgeMat(){return T3.edge||(T3.edge=new THREE.LineBasicMaterial({color:0x2f343a,transparent:true,opacity:.22}))}
// caja con centro x,z y base en y
function bx(g,w,h,d,c,x,y,z,o){
  if(w<=0||h<=0||d<=0)return;
  const geo=new THREE.BoxGeometry(w,h,d),m=new THREE.Mesh(geo,mat(c,o));m.position.set(x,y+h/2,z);g.add(m);
  if(!o&&Math.min(w,h,d)>1.2){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),edgeMat());e.position.copy(m.position);g.add(e)}
  return m;
}
function cyl(g,ra,rb,h,c,x,y,z,seg){const m=new THREE.Mesh(new THREE.CylinderGeometry(ra,rb,h,seg||24),mat(c));m.position.set(x,y+h/2,z);g.add(m);return m}
// pieza que gira alrededor del centro (aspas, patas de la silla)
function spoke(g,len,h,w,c,y,ang){const geo=new THREE.BoxGeometry(len,h,w);geo.translate(len/2,0,0);const m=new THREE.Mesh(geo,mat(c));m.position.set(0,y+h/2,0);m.rotation.y=ang;g.add(m)}
// caja definida por un tramo de pared (ver wrect)
function wbox(g,R,side,a0,a1,o0,o1,y0,y1,c,op){if(a1-a0<.01||o1-o0<.01||y1-y0<.01)return;const r=wrect(R,side,a0,a1,o0,o1);return bx(g,r.w,y1-y0,r.d,c,r.x+r.w/2,y0,r.y+r.d/2,op)}
function floorTexture(){
  if(T3.floorTex)return T3.floorTex;
  const cv=document.createElement('canvas');cv.width=512;cv.height=512;const x=cv.getContext('2d');
  const tones=['#CDA97F','#C49F74','#D3B088','#C8A479','#BF9A6E'];
  for(let r=0;r<8;r++){const off=(r*137)%256;for(let k=-1;k<3;k++){x.fillStyle=tones[(r*3+k+5)%5];x.fillRect(off+k*256,r*64,256,64)}}
  x.strokeStyle='rgba(90,60,30,.35)';x.lineWidth=2;
  for(let r=0;r<=8;r++){x.beginPath();x.moveTo(0,r*64);x.lineTo(512,r*64);x.stroke()}
  for(let r=0;r<8;r++){const off=(r*137)%256;for(let k=0;k<3;k++){const xx=off+k*256;x.beginPath();x.moveTo(xx,r*64);x.lineTo(xx,r*64+64);x.stroke()}}
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return T3.floorTex=t;
}
function subSpan(spans,a,b){const out=[];for(const[s,e]of spans){if(b<=s||a>=e){out.push([s,e]);continue}if(a>s)out.push([s,a]);if(b<e)out.push([b,e])}return out}

/* habitación: paredes con huecos para puertas, ventanas y elementos empotrados */
function buildRoom(g,R){
  const W=R.W,L=R.L,H=R.H||250,TW=10,WALL=C3.wall;
  const tex=floorTexture().clone();tex.needsUpdate=true;tex.repeat.set(W/160,L/160);
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(W,L),new THREE.MeshLambertMaterial({map:tex}));fl.rotation.x=-Math.PI/2;fl.position.set(W/2,0,L/2);g.add(fl);
  bx(g,W+2*TW,2,L+2*TW,C3.stub,W/2,-2.1,L/2);
  const ceil=new THREE.Mesh(new THREE.PlaneGeometry(W+2*TW,L+2*TW),new THREE.MeshLambertMaterial({color:0xF7F5F1,side:THREE.DoubleSide}));
  ceil.rotation.x=Math.PI/2;ceil.position.set(W/2,H,L/2);ceil.visible=false;g.add(ceil);T3.ceiling=ceil;
  const walls={};
  for(const side of SIDES){
    const grp=new THREE.Group();walls[side]=grp;g.add(grp);
    const len=wallLen(R,side),cuts=[],rec=[];
    // zócalo bajo siempre visible para orientarse cuando la pared está recortada
    wbox(g,R,side,-TW,len+TW,0,TW,0,5,C3.stub);
    for(const o of R.openings)if(o.wall===side){
      if(o.type==='door'){const fr=o.frame||0;cuts.push({a0:o.pos-fr,a1:o.pos+o.width+fr,y0:0,y1:o.height+fr})}
      else cuts.push({a0:o.pos,a1:o.pos+o.width,y0:o.sill,y1:o.sill+o.height});
    }
    for(const f of R.fixtures)if(f.wall===side&&f.inset){
      rec.push({a0:f.pos,a1:f.pos+f.len,d:f.depth,rh:Math.min(H,f.rh||H)});
      const r=fixRect(R,f);bx(grp,r.w,1,r.d,C3.stub,r.x+r.w/2,-.9,r.y+r.d/2);
    }
    const xs=[...new Set([-TW,len+TW,...cuts.flatMap(c=>[c.a0,c.a1]),...rec.flatMap(r=>[r.a0,r.a1])].map(v=>Math.min(Math.max(v,-TW),len+TW)))].sort((a,b)=>a-b);
    for(let i=0;i<xs.length-1;i++){
      const s=xs[i],e=xs[i+1],mid=(s+e)/2;if(e-s<.01)continue;
      const cs=cuts.filter(c=>c.a0<mid&&c.a1>mid),rr=rec.filter(r=>r.a0<mid&&r.a1>mid).sort((a,b)=>b.d-a.d)[0];
      let sp=[[0,H]];if(rr)sp=subSpan(sp,0,rr.rh);for(const c of cs)sp=subSpan(sp,c.y0,c.y1);
      for(const[y0,y1]of sp)wbox(grp,R,side,s,e,0,TW,y0,y1,WALL);
      if(rr){let bs=[[0,rr.rh]];for(const c of cs)bs=subSpan(bs,c.y0,c.y1);for(const[y0,y1]of bs)wbox(grp,R,side,s,e,rr.d,rr.d+TW,y0,y1,WALL)}
    }
    for(const rr of rec){
      wbox(grp,R,side,rr.a0-1,rr.a0,0,rr.d+TW,0,rr.rh,WALL);wbox(grp,R,side,rr.a1,rr.a1+1,0,rr.d+TW,0,rr.rh,WALL);
      if(rr.rh<H)wbox(grp,R,side,rr.a0,rr.a1,-3,rr.d,rr.rh-3,rr.rh,WALL); // alféizar
    }
    for(const o of R.openings)if(o.wall===side){
      if(o.type==='window'){
        const fw=7,a=o.pos,b=o.pos+o.width,y0=o.sill,y1=o.sill+o.height,fb=(p,q,u,v)=>wbox(grp,R,side,p,q,TW/2-4,TW/2+4,u,v,C3.frame);
        fb(a,a+fw,y0,y1);fb(b-fw,b,y0,y1);fb(a,b,y0,y0+fw);fb(a,b,y1-fw,y1);
        const mm=a+o.width*.6;fb(mm-2.5,mm+2.5,y0+fw,y1-fw);
        wbox(grp,R,side,a+fw,b-fw,TW/2-.5,TW/2+.5,y0+fw,y1-fw,C3.glass,.45);
      }else{
        const fr=o.frame||0,a=o.pos,b=o.pos+o.width,dh=o.height;
        if(fr){wbox(grp,R,side,a-fr,a,-2,1,0,dh+fr,C3.white);wbox(grp,R,side,b,b+fr,-2,1,0,dh+fr,C3.white);wbox(grp,R,side,a-fr,b+fr,-2,1,dh,dh+fr,C3.white)}
        wbox(grp,R,side,a,b,1,5,0,dh,C3.white);
        const hx=o.hinge==='end'?a+7:b-7;wbox(grp,R,side,hx-6,hx+6,-1.5,1,99,101.5,C3.handle);
      }
    }
  }
  for(const f of R.fixtures)fixtureModel(f.wall?walls[f.wall]:g,R,f);
  if(R.lamp){cyl(g,.4,.4,40,0x555555,W/2,H-40,R.L/2,6);cyl(g,12,25,32,0xC9A46A,W/2,H-72,R.L/2,28)}
  return walls;
}
function fixtureModel(g,R,f){
  const H=R.H||250,r=fixRect(R,f);
  if(f.type==='niche')return;
  if(f.type==='column'){bx(g,r.w,f.h||H,r.d,C3.wall,r.x+r.w/2,0,r.y+r.d/2);return}
  if(f.type==='box'||!f.wall){bx(g,r.w,f.h||90,r.d,0xDDD8D0,r.x+r.w/2,0,r.y+r.d/2);return}
  const s=f.wall,a=f.pos,b=f.pos+f.len;
  if(f.type==='wardrobe'){
    const rh=f.inset?Math.min(H,f.rh||H):(f.h||220),dh=Math.min(200,rh),face=f.inset?0:-f.depth,n=f.doors||Math.max(1,Math.round(f.len/60));
    if(f.inset)wbox(g,R,s,a,b,0,3,0,dh,C3.white);else wbox(g,R,s,a,b,-f.depth,0,0,rh,C3.white);
    for(let k=1;k<n;k++){const x=a+f.len*k/n;wbox(g,R,s,x-.4,x+.4,face-.6,face,2,dh-2,0x9a958e);wbox(g,R,s,x-6,x-4.6,face-2.2,face,95,121,C3.handle);wbox(g,R,s,x+4.6,x+6,face-2.2,face,95,121,C3.handle)}
    if(n===1)wbox(g,R,s,b-8,b-6.6,face-2.2,face,95,121,C3.handle);
    if(f.inset&&dh<rh)wbox(g,R,s,a,b,0,f.depth,dh,dh+2,0xE6E2DB);
    return;
  }
  if(f.type==='radiator'){
    const tr=Math.min(7,f.depth-1),c0=f.inset?f.depth/2+1-tr/2:-tr-1,hh=f.h||55;
    wbox(g,R,s,a,b,c0,c0+tr,15,15+hh,C3.white);
    for(let x=a+5;x<b-2;x+=5)wbox(g,R,s,x-.6,x+.6,c0-1,c0,16.5,13.5+hh,0xdedbd5);
  }
}

/* modelos de muebles: ancho en X, fondo en Z, la parte trasera mira a -Z */
function model(it,lw,ld,R){
  const g=new THREE.Group(),col=HEX[it.color]||0xDEDDD7,h=it.h||60,H=R.H||250;
  if(it.kind==='overlay'){bx(g,lw,1,ld,col,0,0,0);return g}
  if(it.kind==='wall'){const ph=it.h||70;bx(g,lw,ph,2.5,0x3b3b3b,0,150-ph/2,-ld/2+1.25);bx(g,lw-5,ph-5,1,col,0,150-ph/2+2.5,-ld/2+3);return g}
  const legs=(lh,t,c,inset)=>[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>bx(g,t,lh,t,c,a*(lw/2-inset-t/2),0,b*(ld/2-inset-t/2)));
  switch(it.type){
  case 'ceilingfan':{const y=H-30;cyl(g,.8,.8,30,0x777777,0,y,0,8);cyl(g,8,8,8,C3.white,0,y-4,0);for(let i=0;i<5;i++)spoke(g,lw/2-2,1,12,C3.white,y,i*Math.PI*2/5);return g}
  case 'crib':{
    const ch=it.h||90,p=4.5;legs(ch,p,C3.white,0);
    bx(g,lw-2*p,4,ld-2*p,C3.white,0,22,0);bx(g,lw-2*p,10,ld-2*p,0xF7ECEF,0,26,0);
    for(const zs of[-1,1]){bx(g,lw-2*p,4,3,C3.white,0,ch-4,zs*(ld/2-p/2));bx(g,lw-2*p,4,3,C3.white,0,26,zs*(ld/2-p/2));for(let x=-lw/2+p+5;x<lw/2-p-1;x+=8.5)bx(g,2.2,ch-34,2.2,C3.white,x,30,zs*(ld/2-p/2))}
    for(const xs of[-1,1]){bx(g,3,4,ld-2*p,C3.white,xs*(lw/2-p/2),ch-4,0);bx(g,3,4,ld-2*p,C3.white,xs*(lw/2-p/2),26,0);for(let z=-ld/2+p+5;z<ld/2-p-1;z+=8.5)bx(g,2.2,ch-34,2.2,C3.white,xs*(lw/2-p/2),30,z)}
    return g}
  case 'kallax':case 'shelf':{
    const kh=it.h||147,t=it.type==='kallax'?3.5:2,c=C3.wood;
    bx(g,lw,t,ld,c,0,0,0);bx(g,lw,t,ld,c,0,kh-t,0);bx(g,t,kh,ld,c,-lw/2+t/2,0,0);bx(g,t,kh,ld,c,lw/2-t/2,0,0);
    bx(g,lw-2*t,kh-2*t,1,C3.woodDark,0,t,-ld/2+.5);
    const cols=it.type==='kallax'?Math.max(1,Math.round(lw/37.5)):Math.max(1,Math.round(lw/80)),rows=it.type==='kallax'?Math.max(1,Math.round(kh/37.5)):Math.max(2,Math.round(kh/36));
    for(let i=1;i<cols;i++)bx(g,1.6,kh-2*t,ld-1,c,-lw/2+i*lw/cols,t,.5);
    for(let j=1;j<rows;j++)bx(g,lw-2*t,1.6,ld-1,c,0,j*kh/rows-.8,.5);
    return g}
  case 'chair':{
    // silla de oficina: base de 5 radios con ruedas, pistón, asiento, brazos y respaldo de malla
    const c=C3.dark,grey=0x45484E,metal=0xA3A6AA,R0=Math.min(lw,ld)/2-3;
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;spoke(g,R0,3,4.5,c,4,a);const m=new THREE.Mesh(new THREE.SphereGeometry(2.6,10,8),mat(0x1F2023));m.position.set(Math.cos(a)*R0,2.6,-Math.sin(a)*R0);g.add(m)}
    cyl(g,5,5,5,c,0,4,0,16);cyl(g,2.2,2.2,30,metal,0,9,0,12);
    bx(g,18,4,18,c,0,39,0);
    bx(g,48,7,46,0x33363B,0,43,1);bx(g,44,2.5,42,grey,0,50,1.5);
    for(const s of[-1,1]){bx(g,3,18,4,c,s*24.5,50,-4);bx(g,6,3,24,0x2A2C30,s*24.5,68,-2)}
    bx(g,6,24,4,c,0,44,-23);
    const back=new THREE.Group();back.position.set(0,64,-24);back.rotation.x=-.14;g.add(back);
    bx(back,46,4,4,c,0,0,0);bx(back,46,4,4,c,0,50,0);bx(back,4,54,4,c,-21,0,0);bx(back,4,54,4,c,21,0,0);
    bx(back,38,46,1,0x3A3D43,0,4,0);bx(back,30,7,2.5,grey,0,10,1);
    return g}
  case 'dchair':{
    const c=col===HEX.sand?C3.wood:col,sh=45;legs(sh,3,c,1);
    bx(g,lw,4,ld,c,0,sh,0);bx(g,lw,Math.max(10,h-sh-4),3,c,0,sh+4,-ld/2+1.5);return g}
  case 'table':{
    const c=col===HEX.sand?C3.wood:col;bx(g,lw,3,ld,c,0,h-3,0);legs(h-3,4,c,4);return g}
  case 'desk':{
    const dh=it.h||75,c=C3.white,uw=Math.min(36,lw/3);
    bx(g,lw,3,ld,c,0,dh-3,0);bx(g,2.5,dh-3,ld,c,-lw/2+1.25,0,0);bx(g,uw,dh-3,ld-2,c,lw/2-uw/2,0,-1);
    bx(g,uw-4,.6,.6,0x9a958e,lw/2-uw/2,dh-20,ld/2-1.6);bx(g,uw-4,.6,.6,0x9a958e,lw/2-uw/2,dh-42,ld/2-1.6);
    bx(g,lw-uw-2.5,35,1.5,c,-uw/2+1.25,dh-38,-ld/2+.75);
    return g}
  case 'smastad':{
    const c=C3.white,top=85;
    bx(g,2.5,top,ld,c,-lw/2+1.25,0,0);bx(g,2.5,top,ld,c,lw/2-1.25,0,0);
    bx(g,lw-5,2,ld-2,c,0,8,0);bx(g,lw-5,2,ld-2,c,0,42,0);bx(g,lw,3,ld,c,0,top-3,0);
    bx(g,lw-5,8,1.5,c,0,0,ld/2-1);bx(g,lw-5,top-3,1.5,c,0,0,-ld/2+.75);
    bx(g,lw,15,2,c,0,top,-ld/2+1);bx(g,2,15,ld,c,-lw/2+1,top,0);bx(g,2,15,ld,c,lw/2-1,top,0);
    bx(g,lw-8,5,ld-8,0xD7E6E0,0,top,1);
    return g}
  case 'changer':case 'dresser':case 'chest':case 'nightstand':case 'tvstand':{
    const chest=it.type==='chest',c=chest||it.type==='nightstand'?col:C3.white,ft=it.type==='tvstand'||it.type==='nightstand'?6:0,ch=h-ft;
    if(ft)legs(ft,3,0x6b625a,2);
    bx(g,lw,ch,ld,c,0,ft,0);
    if(it.type==='tvstand'){const n=Math.max(2,Math.round(lw/50));for(let i=1;i<n;i++)bx(g,.6,ch-4,.6,0x9a958e,-lw/2+i*lw/n,ft+2,ld/2+.3)}
    else{const k=chest?1:Math.max(it.type==='nightstand'?2:2,Math.round(ch/25));for(let i=1;i<k;i++)bx(g,lw-4,.6,.6,0x9a958e,0,ft+i*ch/k,ld/2+.3)}
    if(it.type==='changer'){bx(g,lw,10,2,c,0,ch,-ld/2+1);bx(g,lw-6,4,ld-8,0xD7E6E0,0,ch,1)}
    return g}
  case 'sofabed_open':bx(g,lw,22,ld,0x8C8A88,0,0,0);bx(g,lw-4,16,ld-4,0xEDE7DE,0,22,0);return g;
  case 'sofabed_closed':bx(g,lw,42,ld,0x8C8A88,0,0,0);bx(g,lw,(it.h||75)-42,20,0x7E7C7A,0,42,-ld/2+10);return g;
  case 'sofa':{
    const sh=44,arm=Math.min(16,lw/8),n=Math.max(1,Math.round((lw-2*arm)/65)),cw=(lw-2*arm)/n;
    legs(8,4,0x4a4440,3);bx(g,lw,sh-16,ld,col,0,8,0);
    for(let i=0;i<n;i++)bx(g,cw-1.5,8,ld-20,col,-lw/2+arm+cw*(i+.5),sh-8,8);
    bx(g,lw-2*arm,Math.max(20,h-sh+8),18,col,0,sh-8,-ld/2+9);
    for(const s of[-1,1])bx(g,arm,22,ld,col,s*(lw/2-arm/2),sh-8,0);
    return g}
  case 'bed':
    bx(g,lw,25,ld,C3.white,0,0,0);bx(g,lw-4,20,ld-4,0xFBFAF7,0,25,0);
    if(lw>=ld){bx(g,lw*.62,4,ld-8,col,lw*.17,45,0);bx(g,24,10,ld-24,0xFFFFFF,-lw/2+16,45,0)}
    else{bx(g,lw-8,4,ld*.62,col,0,45,ld*.17);bx(g,lw-24,10,24,0xFFFFFF,0,45,-ld/2+16)}
    return g;
  case 'ballpit':{
    const ph=it.h||30,t=10,c=C3.foam;
    bx(g,lw,ph,t,c,0,0,-ld/2+t/2);bx(g,lw,ph,t,c,0,0,ld/2-t/2);bx(g,t,ph,ld-2*t,c,-lw/2+t/2,0,0);bx(g,t,ph,ld-2*t,c,lw/2-t/2,0,0);
    bx(g,lw-2*t,5,ld-2*t,0xD9D3CA,0,0,0);
    const cs=[0xF4C9D6,0xCFE0F2,0xFFFFFF,0xEBD9B4,0xCFE3CF];
    T3.ballGeo=T3.ballGeo||new THREE.SphereGeometry(3.6,10,8);
    let sd=7;const rnd=()=>{sd=(sd*9301+49297)%233280;return sd/233280};
    const nb=Math.min(160,Math.round((lw-2*t)*(ld-2*t)/30));
    for(let i=0;i<nb;i++){const m=new THREE.Mesh(T3.ballGeo,mat(cs[i%5]));m.position.set((rnd()-.5)*(lw-2*t-8),9+rnd()*12,(rnd()-.5)*(ld-2*t-8));g.add(m)}
    return g}
  case 'armchair':bx(g,lw,40,ld,col,0,0,0);bx(g,lw,50,16,col,0,40,-ld/2+8);bx(g,12,22,ld-16,col,-lw/2+6,40,8);bx(g,12,22,ld-16,col,lw/2-6,40,8);return g;
  case 'playpen':{
    const ph=it.h||70;legs(ph,4,C3.white,0);bx(g,lw-4,3,ld-4,col,0,0,0);
    bx(g,lw-8,ph-6,.6,0xffffff,0,3,-ld/2+2,.35);bx(g,lw-8,ph-6,.6,0xffffff,0,3,ld/2-2,.35);bx(g,.6,ph-6,ld-8,0xffffff,-lw/2+2,3,0,.35);bx(g,.6,ph-6,ld-8,0xffffff,lw/2-2,3,0,.35);
    return g}
  case 'fan':{cyl(g,lw*.3,lw*.35,3,0x555555,0,0,0);cyl(g,1.5,1.5,h-25,0x777777,0,3,0,8);const m=cyl(g,lw/2,lw/2,8,C3.white,0,h-20-lw/2,0);m.rotation.x=Math.PI/2;return g}
  case 'lamp':cyl(g,lw*.35,lw*.35,3,0x444444,0,0,0);cyl(g,1,1,h-30,0x666666,0,3,0,8);cyl(g,lw*.3,lw/2,28,0xF1E8D8,0,h-28,0);return g;
  }
  if(it.shape==='round'){cyl(g,lw/2,lw/2,h,col,0,0,0,32);g.scale.z=ld/lw;return g}
  bx(g,lw,h,ld,col,0,0,0);
  return g;
}
function build3d(){
  if(!T3.renderer)return;
  const R=room(),W=R.W,L=R.L,items=cur().items;
  if(T3.group){T3.scene.remove(T3.group);T3.group.traverse(o=>{if(o.geometry&&o.geometry!==T3.ballGeo)o.geometry.dispose()})}
  const g=new THREE.Group();T3.group=g;T3.scene.add(g);T3.itemObjs=[];
  T3.walls=buildRoom(g,R);
  const faceTo=(f,cx,cz,re)=>{ // la silla mira a la mesa o escritorio más cercano
    const t=items.filter(i=>re.test(i.type)).map(fp).sort((a,b)=>rdist(a,f)-rdist(b,f))[0];
    if(!t||rdist(t,f)>=120)return null;
    const dx=Math.max(t.x,Math.min(cx,t.x+t.w))-cx,dz=Math.max(t.y,Math.min(cz,t.y+t.d))-cz;
    return dx||dz?Math.atan2(dx,dz):null;
  };
  for(const it of items){
    const f=fp(it),cx=f.x+f.w/2,cz=f.y+f.d/2;
    const dist={top:f.y,bottom:L-f.y-f.d,left:f.x,right:W-f.x-f.w};
    let side=Object.keys(dist).reduce((a,b)=>dist[b]<dist[a]?b:a);
    if(it.kind==='ceiling'||it.kind==='overlay')side=f.w>=f.d?'top':'left';
    const along=side==='top'||side==='bottom',lw=along?f.w:f.d,ld=along?f.d:f.w;
    const m=model(it,lw,ld,R);
    m.rotation.y={top:0,bottom:Math.PI,left:Math.PI/2,right:-Math.PI/2}[side];
    if(it.type==='chair'){const a=faceTo(f,cx,cz,/^desk$/);if(a!==null)m.rotation.y=a}
    if(it.type==='dchair'){const a=faceTo(f,cx,cz,/^(table|desk)$/);if(a!==null)m.rotation.y=a}
    if(it.id===selId){
      const rot=m.rotation.y;m.rotation.y=0;const b=new THREE.Box3().setFromObject(m);b.expandByScalar(1.5);
      const hl=new THREE.Box3Helper(b,new THREE.Color(C3.accent));m.add(hl);m.rotation.y=rot;
    }
    m.userData.id=it.id;m.position.set(cx,0,cz);g.add(m);T3.itemObjs.push(m);
  }
  if(T3.framedRoom!==R.id){T3.framedRoom=R.id;resize3d();isoView();if(walk)setWalk(true)}else cutaway();
}
async function open3d(){
  $('#msg3d').textContent='Cargando la vista 3D…';
  try{await ensureThree()}catch(e){$('#msg3d').textContent='No se pudo cargar la vista 3D. Comprueba la conexión a internet.';return}
  init3d();resize3d();build3d();msg3d();
}
