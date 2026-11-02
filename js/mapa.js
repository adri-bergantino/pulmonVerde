/*
 * Mapa general del recorrido (Leaflet + OpenStreetMap).
 *
 * Los parques NO están escritos acá: se leen de la lista #lista-recorrido
 * del index.html (atributos data-orden, data-lat, data-lng, data-nombre).
 * Para cambiar el orden o las coordenadas se edita solo el HTML.
 */
(function () {
    "use strict";

    var contenedor = document.getElementById("mapa");
    var lista = document.getElementById("lista-recorrido");
    if (!contenedor || !lista) return;

    // Si la biblioteca no cargó (sin conexión, CDN bloqueado), avisamos y dejamos la lista usable.
    if (typeof L === "undefined") {
        contenedor.innerHTML =
            '<p class="p-6 text-center">No pudimos cargar el mapa. Revisá tu conexión y recargá la página. ' +
            "Mientras tanto, podés usar la lista de parques.</p>";
        return;
    }

    var reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1. Leer los puntos desde el HTML y ordenarlos por data-orden
    var items = Array.prototype.slice.call(lista.querySelectorAll("li[data-orden]"));
    var puntos = items
        .map(function (li) {
            return {
                orden: Number(li.dataset.orden),
                lat: Number(li.dataset.lat),
                lng: Number(li.dataset.lng),
                nombre: li.dataset.nombre,
                li: li
            };
        })
        .filter(function (p) {
            return isFinite(p.lat) && isFinite(p.lng);
        })
        .sort(function (a, b) {
            return a.orden - b.orden;
        });

    if (puntos.length === 0) return;

    // 2. Crear el mapa con teselas de OpenStreetMap
    var mapa = L.map(contenedor, { scrollWheelZoom: false });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapa);

    // 3. Línea que une los parques en el orden sugerido (esquemática, no sigue calles)
    var coordenadas = puntos.map(function (p) {
        return [p.lat, p.lng];
    });
    L.polyline(coordenadas, {
        color: "#C4790A",
        weight: 4,
        opacity: 0.9,
        dashArray: "8 8"
    }).addTo(mapa);

    // 4. Marcadores numerados (el número va en el texto: no depende solo del color)
    var marcadorActivo = null;

    function crearIcono(numero, activo) {
        return L.divIcon({
            className: "",
            html: '<div class="marcador-mapa' + (activo ? " marcador-mapa--activo" : "") + '">' + numero + "</div>",
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -18]
        });
    }

    function marcarActivo(punto) {
        if (marcadorActivo) {
            marcadorActivo.marker.setIcon(crearIcono(marcadorActivo.orden, false));
        }
        punto.marker.setIcon(crearIcono(punto.orden, true));
        marcadorActivo = punto;
    }

    puntos.forEach(function (punto) {
        var etiqueta = "Parada " + punto.orden + ": " + punto.nombre;

        punto.marker = L.marker([punto.lat, punto.lng], {
            icon: crearIcono(punto.orden, false),
            title: etiqueta,
            alt: etiqueta,
            keyboard: true
        }).addTo(mapa);

        // Popup armado con nodos de texto (sin innerHTML)
        var popup = document.createElement("div");
        var titulo = document.createElement("strong");
        titulo.textContent = punto.orden + ". " + punto.nombre;
        popup.appendChild(titulo);
        punto.marker.bindPopup(popup);

        punto.marker.on("click", function () {
            marcarActivo(punto);
        });
    });

    // 5. Ajustar la vista para que entren todos los parques
    mapa.fitBounds(coordenadas, { padding: [40, 40] });

    // Los marcadores son div (divIcon): les damos nombre accesible para lectores de pantalla.
    // Se hace después de fitBounds porque antes el elemento del marcador todavía no existe.
    puntos.forEach(function (punto) {
        var elemento = punto.marker.getElement();
        if (elemento) {
            elemento.setAttribute("aria-label", "Parada " + punto.orden + ": " + punto.nombre);
        }
    });

    // 6. Botones "Ver en el mapa" de la lista
    items.forEach(function (li) {
        var boton = li.querySelector('[data-accion="ver-en-mapa"]');
        if (!boton) return;

        boton.addEventListener("click", function () {
            var punto = puntos.filter(function (p) {
                return p.li === li;
            })[0];
            if (!punto) return;

            contenedor.scrollIntoView({
                behavior: reducirMovimiento ? "auto" : "smooth",
                block: "center"
            });

            var destino = [punto.lat, punto.lng];
            if (reducirMovimiento) {
                mapa.setView(destino, 15);
            } else {
                mapa.flyTo(destino, 15, { duration: 1 });
            }

            marcarActivo(punto);
            punto.marker.openPopup();
        });
    });
})();
