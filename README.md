# Planificador de casa

Plano a escala para probar dónde colocar los muebles de cada habitación, empezando por el cuarto de la bebé (275 × 350 cm).

## Cómo usarlo

- **En el móvil o en cualquier navegador:** abre la web de GitHub Pages del repositorio. En el móvil puedes instalarla («Añadir a pantalla de inicio») y funciona sin conexión.
- **En tu ordenador:** descarga `index.html` y ábrelo con doble clic.

### Qué se puede hacer

- **Plano:** arrastra los muebles. Muestra choques, avisos de seguridad del bebé (radiador, ventana), espacios de paso estrechos y la distancia al obstáculo más cercano. Pellizca o usa los botones para acercar.
- **Habitación:** cambia las medidas, mueve o añade puertas, ventanas, radiadores, columnas y armarios empotrados. Crea más habitaciones desde el selector junto al título.
- **3D:** vista isométrica o «a pie». Toca un mueble para seleccionarlo y arrástralo para moverlo.
- **Lista de compra:** muebles que queréis incorporar, con enlace, precio y estado. «Probar en el plano» lo coloca en su habitación.
- **Guardar, compartir e imprimir:** copia de seguridad en archivo, imagen del plano o del 3D, impresión / PDF.

Atajos en el ordenador: flechas para mover 1 cm (Mayús 10 cm), `R` gira, `L` fija, `Supr` quita, `Ctrl+Z` deshace.

Los datos se guardan en el navegador donde los hagas. Para pasarlos a otro dispositivo usa «Descargar copia» y «Restaurar copia».

La versión anterior sigue disponible en [`versiones/v1/`](versiones/v1/).

## Desarrollo

El código está en `src/` (estilos, estructura y un archivo por módulo en `src/js/`). Para generar `index.html`:

```
node build.js
```

## Planos (dentro de BAS)

El mismo planificador funciona también como app **Planos** de BAS, en `https://bas.tailabfbf3.ts.net/planos/`:

- BAS hace el inicio de sesión y da el permiso; Planos recibe al usuario en la cabecera firmada `X-BAS-Usuario`.
- Cada usuario crea, renombra y borra sus planos. Se guardan en el servidor (`data/`, fuera de git) con guardado automático.
- Un plano se puede compartir con otro usuario de BAS como «puede editar» o «solo ver». El dueño puede quitar el acceso.
- Si dos personas guardan a la vez, la segunda recibe la versión más reciente en lugar de pisar la otra.
- Three.js y las fuentes se sirven en local (sin CDN).

Código en `bas/` (servidor) y `src/bas/` (barra y diálogo de proyectos). `node build.js` genera también `bas/public/`.

```
npm install
npm test                      # pruebas del servidor
node bas/prueba-local.mjs     # prueba sin BAS: http://127.0.0.1:5191/planos/?como=ana
```

BAS lo arranca con `node bas/servidor.mjs` y las variables `BAS_APP=planos`, `BAS_SECRETO_ARCHIVO`, `PORT=5190` y `PLANOS_DATOS`.
