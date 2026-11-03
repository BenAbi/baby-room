// Genera index.html (una sola página autónoma) a partir de src/: node build.js
const fs=require('fs'),path=require('path');
const dir=p=>path.join(__dirname,p),read=p=>fs.readFileSync(dir(p),'utf8');

const js=fs.readdirSync(dir('src/js')).filter(f=>f.endsWith('.js')).sort()
  .map(f=>`// ── ${f}\n${read('src/js/'+f)}`).join('\n');
const css=read('src/app.css'),body=read('src/body.html');
const THREE_VER='0.160.0';
const shared=`<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@${THREE_VER}/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@${THREE_VER}/examples/jsm/"}}</script>
<style>
[hidden]{display:none!important}
${css}</style>
`;
const app=`${body}
<script>
(function(){
'use strict';
${js}
})();
</script>
`;

const page=`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Planificador de casa</title>
<meta name="theme-color" content="#EDF0F3">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Casa">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-192.png">
<style>body{margin:0}:root{padding-top:env(safe-area-inset-top,0px)}</style>
${shared}</head>
<body>
${app}</body>
</html>
`;
fs.writeFileSync(dir('index.html'),page);
// versión incrustable (sin cabecera de documento) para previsualizar dentro de otras páginas
fs.mkdirSync(dir('dist'),{recursive:true});
fs.writeFileSync(dir('dist/embed.html'),`<title>Planificador de casa</title>\n${shared}${app}`);
console.log('index.html',(page.length/1024).toFixed(1)+' KB');
