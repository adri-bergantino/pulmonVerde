**Pulmón Verde**

Pulmón Verde es un proyecto para la materia Diseño y Desarrollo Web. Reúne cuatro de los parques más emblemáticos de la Ciudad de Buenos Aires en una misma propuesta de recorrido, con información para preparar la visita. El nombre y el logo, que muestra un árbol dividido simétricamente, retoman la idea de los espacios verdes como pulmones de la ciudad, siendo un espacio vital para los vecinos.

**Objetivo y público**

El sitio busca promover la visita y el disfrute de estos espacios, contando qué se puede hacer y qué conviene saber antes de ir. Está pensado para residentes de la ciudad, familias, estudiantes y turistas que buscan actividades al aire libre, lugares para descansar o propuestas culturales.

**El recorrido**

El mapa propone un recorrido de sur a norte: Parque Centenario, Parque Thays, Ecoparque y Parque Barrancas de Belgrano. La línea une las paradas en ese orden.

**Qué incluye**

- Una página con información, fotos y ubicación de cada parque.
- Un mapa interactivo. Se puede elegir una parada desde la lista o desde el mapa.
- Un formulario de reserva de demostración que calcula el total en dólares y su equivalente aproximado en pesos.
- Un formulario de contacto y un asistente con respuestas sobre los parques.

Las reservas no se guardan ni procesan pagos. El formulario de contacto tampoco envía mensajes. El asistente responde a partir de palabras clave y de la información guardada en `chat.json`.

**Tecnologías y servicios**

La página está hecha con HTML, CSS y JavaScript. El diseño usa las fuentes Fraunces y Outfit, cargadas desde Google Fonts. Leaflet muestra el mapa y OpenStreetMap aporta sus teselas. Las páginas de los parques también incluyen mapas de Google Maps.

El formulario consulta DolarAPI para obtener la cotización oficial de venta y mostrar una estimación en pesos. Si la consulta no funciona, usa el último valor guardado en el navegador o un valor de respaldo.


**Archivos del proyecto**

- `index.html`: inicio y mapa del recorrido.
- `thays.html`, `ecoparque.html`, `centenario.html` y `barrancas.html`: páginas de los parques.
- `formulario.html`, `contacto.html` y `chat.html`: reserva, contacto y asistente.
- `js/`: código JavaScript del mapa, formularios, validación y chat.
- `chat.json`: respuestas del asistente.
- `Fotos/`: logo e imágenes.
- `input.css`: estilos y componentes compartidos del sistema de diseño.
- `output.css`: estilos generados por Tailwind.
- `package.json` y `package-lock.json`: scripts y dependencias para compilar los estilos.


**Acceso al sitio**

Para consultar el sitio web, ingresar por este enlace: [Pulmón Verde](https://adri-bergantino.github.io/pulmonVerde/).

**Enlaces**

- Repositorio: [GitHub](https://github.com/adri-bergantino/pulmonVerde)
- Prototipo: [Figma](https://www.figma.com/design/fLucM7TC4J0sqm0784Cmmj/Untitled?node-id=0-1&p=f&t=NKC1G5B84JyQEcp0-0)
- Sistema de diseño: [input.css](input.css)

**Integrantes**

- Adriel Bergantino (legajo 1111637): Parque Thays y README.
- Juliana Rita Dominguez (legajo 1193078): Parque Centenario, formularios y mapas.
- Tomas Curti (legajo 1164723): Ecoparque, estructura del sitio e implementación del chatbot.
- Mateo Bichutte Harris (legajo 1174425): Parque Barrancas de Belgrano.
