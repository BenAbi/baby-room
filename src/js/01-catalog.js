/* catálogo de muebles: cada mueble lleva un tipo que decide su modelo 3D */
const COLORS=['rose','sand','sage','sky','lilac','stone'];
const COLOR_NAMES={rose:'Rosa',sand:'Arena',sage:'Salvia',sky:'Cielo',lilac:'Lila',stone:'Piedra'};
const KINDS={floor:'Ocupa suelo',overlay:'Alfombra (no choca)',wall:'Colgado en la pared',ceiling:'En el techo'};
const TYPES={
  box:'Caja (genérico)',crib:'Cuna',changer:'Cómoda cambiador',smastad:'Cambiador SMÅSTAD',armchair:'Sillón',
  sofa:'Sofá',playpen:'Parque de juegos',chest:'Baúl',ballpit:'Piscina de bolas',bed:'Cama',
  sofabed_open:'Sofá cama abierto',sofabed_closed:'Sofá cama cerrado',nightstand:'Mesita',dresser:'Cómoda',
  kallax:'Estantería de cubos',shelf:'Estantería alta',desk:'Escritorio',chair:'Silla de oficina',dchair:'Silla',
  table:'Mesa',tvstand:'Mueble bajo / TV',fan:'Ventilador de pie',ceilingfan:'Ventilador de techo',
  lamp:'Lámpara de pie',rug:'Alfombra',picture:'Cuadro'
};
const TYPE_KIND={rug:'overlay',picture:'wall',ceilingfan:'ceiling'};
const BABY_TYPES={crib:1};

const CATALOG=[
  {group:'Bebé',items:[
    {name:'Cuna 60×120',type:'crib',w:66,d:126,h:90,color:'rose'},
    {name:'Cuna convertible 70×140',type:'crib',w:76,d:146,h:90,color:'rose'},
    {name:'Minicuna / colecho',type:'crib',w:55,d:95,h:80,color:'rose'},
    {name:'Cómoda cambiador',type:'changer',w:80,d:50,h:95,color:'sand'},
    {name:'Cambiador IKEA SMÅSTAD',type:'smastad',w:90,d:79,h:100,color:'sand'},
    {name:'Sillón de lactancia',type:'armchair',w:75,d:80,h:100,color:'sage'},
    {name:'Parque de juegos',type:'playpen',w:100,d:100,h:70,color:'sky'},
    {name:'Baúl de juguetes',type:'chest',w:60,d:40,h:45,color:'lilac'},
    {name:'Piscina de bolas 88×52',type:'ballpit',w:88,d:52,h:30,color:'stone'}
  ]},
  {group:'Dormitorio',items:[
    {name:'Cama 90×190',type:'bed',w:97,d:200,h:45,color:'sky'},
    {name:'Cama 105×190',type:'bed',w:112,d:200,h:45,color:'sky'},
    {name:'Cama 150×190',type:'bed',w:160,d:200,h:45,color:'sky'},
    {name:'Sofá cama ÄLVDALEN abierto',type:'sofabed_open',w:133,d:188,h:42,color:'lilac'},
    {name:'Sofá cama ÄLVDALEN cerrado ≈',type:'sofabed_closed',w:188,d:95,h:75,color:'lilac'},
    {name:'Mesita de noche',type:'nightstand',w:40,d:35,h:50,color:'sand'},
    {name:'Cómoda',type:'dresser',w:80,d:48,h:80,color:'sand'},
    {name:'Kallax 4×4',type:'kallax',w:149,d:39,h:147,color:'sand'},
    {name:'Kallax 2×4',type:'kallax',w:77,d:39,h:147,color:'sand'},
    {name:'Escritorio MICKE',type:'desk',w:105,d:50,h:75,color:'stone'},
    {name:'Silla de escritorio',type:'chair',w:60,d:60,h:110,color:'stone',shape:'round'}
  ]},
  {group:'Salón y comedor',items:[
    {name:'Sofá 3 plazas',type:'sofa',w:200,d:90,h:85,color:'stone'},
    {name:'Sofá 2 plazas',type:'sofa',w:160,d:88,h:85,color:'stone'},
    {name:'Mesa de centro',type:'table',w:100,d:55,h:45,color:'sand'},
    {name:'Mesa de comedor 140×80',type:'table',w:140,d:80,h:75,color:'sand'},
    {name:'Silla de comedor',type:'dchair',w:45,d:50,h:85,color:'sand'},
    {name:'Mueble TV',type:'tvstand',w:160,d:40,h:50,color:'stone'},
    {name:'Estantería 80×28',type:'shelf',w:80,d:28,h:200,color:'sand'}
  ]},
  {group:'Otros',items:[
    {name:'Ventilador de pie',type:'fan',w:40,d:40,h:120,color:'sky',shape:'round'},
    {name:'Ventilador de techo',type:'ceilingfan',w:107,d:107,h:0,color:'sky',shape:'round',kind:'ceiling'},
    {name:'Alfombra 120×170',type:'rug',w:120,d:170,h:1,color:'lilac',kind:'overlay'},
    {name:'Cuadro',type:'picture',w:100,d:3,h:70,color:'rose',kind:'wall'},
    {name:'Lámpara de pie',type:'lamp',w:35,d:35,h:160,color:'stone',shape:'round'}
  ]}
];
const findCat=n=>{for(const g of CATALOG)for(const i of g.items)if(i.name===n)return i};

// tipo a partir del nombre, para muebles guardados antes de que existieran los tipos
function inferType(name,kind){
  const n=String(name||'').toLowerCase();
  if(kind==='overlay')return 'rug';
  if(kind==='wall')return 'picture';
  const rules=[
    [/silla de comedor/,'dchair'],[/silla/,'chair'],[/escritorio|micke/,'desk'],[/ventilador de techo/,'ceilingfan'],
    [/cuna|colecho/,'crib'],[/kallax/,'kallax'],[/cómoda cambiador/,'changer'],[/småstad|smastad|cambiador/,'smastad'],
    [/cómoda/,'dresser'],[/baúl/,'chest'],[/sofá cama.*abierto/,'sofabed_open'],[/sofá cama/,'sofabed_closed'],
    [/sofá/,'sofa'],[/cama/,'bed'],[/piscina/,'ballpit'],[/sillón/,'armchair'],[/parque/,'playpen'],
    [/ventilador/,'fan'],[/lámpara/,'lamp'],[/mesita/,'nightstand'],[/mesa/,'table'],[/estantería/,'shelf'],[/tv/,'tvstand']
  ];
  for(const[re,t]of rules)if(re.test(n))return t;
  return 'box';
}

function mk(spec,x,y,rot){
  const type=spec.type||inferType(spec.name,spec.kind);
  return {id:uid(),name:spec.name,type,w:spec.w,d:spec.d,h:spec.h||0,x,y,rot:rot||0,color:spec.color||'stone',
    kind:spec.kind||TYPE_KIND[type]||'floor',shape:spec.shape||'rect',baby:!!(spec.baby||BABY_TYPES[type]),
    locked:false,...(spec.wid?{wid:spec.wid}:{})};
}
