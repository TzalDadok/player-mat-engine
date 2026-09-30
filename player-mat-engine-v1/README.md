# Player Mat Engine v1

Motor local HTML/CSS/JS para generar player mats de civilizaciones con una plantilla común.

## Abrir
Abrí `index.html` en Firefox/Chrome/Edge. No necesita servidor ni Internet.

## Archivos
- `index.html`: estructura mínima y barra de herramientas.
- `styles.css`: toda la geometría/estética del mat.
- `app.js`: renderer genérico. No contiene reglas específicas británicas.
- `civs/britanicos.js`: datos del árbol británico.
- `assets/reference-master.png`: imagen maestra aprobada, usada solo como overlay de comparación.
- `assets/buildings/`: ilustraciones recortadas de la imagen maestra.
- `assets/ages/`: arte de las edades recortado de la imagen maestra.

## Cómo crear otra civilización
1. Copiar `civs/britanicos.js` a, por ejemplo, `civs/francos.js`.
2. Cambiar el ID, nombre, subtítulo, edificios/nodos/costes.
3. Agregar `<script src="civs/francos.js"></script>` antes de `app.js` en `index.html`.
4. La nueva civilización aparecerá automáticamente en el selector.

## Convención de colores
- Azul: unidad militar/civil entrenable (`type: "unit"`).
- Verde: tecnología (`type: "tech"`).
- Rojo: construcción (`type: "building"`).

## Posición
La posición NO se dibuja a mano. Cada nodo tiene `age` + `building`, y el motor lo coloca en la intersección correspondiente.

Ejemplo:
```js
{ age:"castles", building:"castle", type:"unit", title:"Arquero de Tiro Largo" }
```

## Referencia
El botón `Referencia` superpone la imagen maestra sobre el HTML. Sirve para ajustar CSS sin perder el diseño aprobado.

## Impresión
`Imprimir / PDF` usa la hoja en horizontal sin márgenes. Para producción final se pueden fijar dimensiones físicas concretas en `@page`.
