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
