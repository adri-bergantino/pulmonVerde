/*
 * Formulario de reserva (simulación).
 *
 * Flujo: completar datos -> total en vivo (USD y ARS) -> resumen -> confirmación.
 *
 * Precios: se leen de los atributos data-* del HTML (data-precio en USD).
 * Dinero: todas las cuentas se hacen en CENTAVOS ENTEROS para evitar errores
 * de coma flotante (0.1 + 0.2 !== 0.3). Solo se convierte a decimal al mostrar.
 *
 * Cotización: se consulta DolarAPI (dólar oficial, valor de venta). Si falla,
 * se usa la última cotización guardada en el navegador y, si no hay, un valor
 * de respaldo fijo. En todos los casos se informa el tipo de cambio, la fuente
 * y la fecha, y si es un respaldo se avisa y se permite reintentar.
 *
 * Depende de js/validacion.js.
 */
(function () {
    "use strict";

    var form = document.getElementById("formulario-reserva");
    if (!form || !window.Validacion) return;
    var V = window.Validacion;

    /* ------------------------------------------------------------------ */
    /* Configuración                                                      */
    /* ------------------------------------------------------------------ */
    var API_URL = "https://dolarapi.com/v1/dolares/oficial";
    var FUENTE_API = "DolarAPI (dólar oficial, valor de venta)";
    var TIEMPO_MAXIMO_API_MS = 6000;
    var CLAVE_CACHE = "pulmonverde_cotizacion";

    // Valor de respaldo si la API no responde y no hay nada guardado.
    // ACTUALIZAR antes de entregar con la cotización real de ese día.
    var COTIZACION_RESPALDO = {
        venta: 1520,
        fecha: "2026-08-06",
        fuente: "Banco Nación, dólar oficial (referencia de prensa, 06/08/2026)",
        origen: "respaldo"
    };

    var CANTIDAD_MINIMA = 1;
    var CANTIDAD_MAXIMA = 20;

    var formatoUSD = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD" });
    var formatoARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

    /* ------------------------------------------------------------------ */
    /* Elementos                                                          */
    /* ------------------------------------------------------------------ */
    function $(id) {
        return document.getElementById(id);
    }

    var pasoFormulario = $("reserva-paso-formulario");
    var pasoResumen = $("reserva-paso-resumen");
    var pasoConfirmacion = $("reserva-paso-confirmacion");
    var resumenErrores = $("reserva-resumen-errores");

    var nombre = $("nombre");
    var email = $("email");
    var fecha = $("fecha");
    var parque = $("parque");
    var experiencia = $("experiencia"); // fieldset de radios
    var cantidad = $("cantidad");
    var radios = form.querySelectorAll('input[name="experiencia"]');
    var adicionales = form.querySelectorAll('input[name="adicional"]');

    var cotizacion = null; // { venta, fecha, fuente, origen }
    var pedidoRevisado = null; // lo que se mostró en el resumen
    var temporizadorAnuncio = null;

    /* ------------------------------------------------------------------ */
    /* Utilidades de dinero y fechas                                      */
    /* ------------------------------------------------------------------ */
    function aCentavos(texto) {
        return Math.round(parseFloat(texto) * 100);
    }

    function enUSD(centavos) {
        return formatoUSD.format(centavos / 100);
    }

    function enARS(centavos) {
        return formatoARS.format(centavos / 100);
    }

    // USD (centavos) x tipo de cambio = ARS (centavos), redondeado al centavo
    function convertirAARS(centavosUSD, venta) {
        return Math.round(centavosUSD * venta);
    }

    function dosDigitos(n) {
        return (n < 10 ? "0" : "") + n;
    }

    // "2026-11-03" en hora local (no UTC, para no correr un día)
    function fechaISOLocal(d) {
        return d.getFullYear() + "-" + dosDigitos(d.getMonth() + 1) + "-" + dosDigitos(d.getDate());
    }

    function fechaLarga(iso) {
        var partes = iso.split("-");
        var d = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
        return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }

    function formatearFechaCotizacion(valor) {
        if (!valor) return "fecha no informada";
        if (valor.length === 10) {
            var p = valor.split("-");
            return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).toLocaleDateString("es-AR");
        }
        var d = new Date(valor);
        if (isNaN(d.getTime())) return "fecha no informada";
        return d.toLocaleString("es-AR", {
            timeZone: "America/Argentina/Buenos_Aires",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
    }

    var hoy = new Date();
    var minimaFecha = fechaISOLocal(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1));
    var maximaFecha = fechaISOLocal(new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate()));
    fecha.min = minimaFecha;
    fecha.max = maximaFecha;

    /* ------------------------------------------------------------------ */
    /* Cálculo del pedido (lógica de precios)                             */
    /* ------------------------------------------------------------------ */
    function experienciaElegida() {
        return form.querySelector('input[name="experiencia"]:checked');
    }

    // Devuelve la cantidad como entero válido, o null
    function leerCantidad() {
        var texto = cantidad.value.trim();
        if (texto === "" || !/^\d+$/.test(texto)) return null;
        var n = Number(texto);
        return n >= CANTIDAD_MINIMA && n <= CANTIDAD_MAXIMA ? n : null;
    }

    function calcularPedido() {
        var exp = experienciaElegida();
        var cant = leerCantidad();
        var lineas = [];

        if (exp && cant) {
            var unitario = aCentavos(exp.dataset.precio);
            lineas.push({
                concepto: exp.dataset.nombre,
                cantidad: cant,
                unitarioCentavos: unitario,
                subtotalCentavos: unitario * cant
            });

            adicionales.forEach(function (extra) {
                if (!extra.checked || extra.disabled) return;
                var unidades = extra.dataset.tipo === "reserva" ? 1 : cant;
                var precio = aCentavos(extra.dataset.precio);
                lineas.push({
                    concepto: extra.dataset.nombre,
                    cantidad: unidades,
                    unitarioCentavos: precio,
                    subtotalCentavos: precio * unidades
                });
            });
        }

        var totalUSD = lineas.reduce(function (suma, l) {
            return suma + l.subtotalCentavos;
        }, 0);

        return {
            experiencia: exp,
            cantidad: cant,
            lineas: lineas,
            totalUSDCentavos: totalUSD,
            totalARSCentavos: cotizacion ? convertirAARS(totalUSD, cotizacion.venta) : null
        };
    }

    /* ------------------------------------------------------------------ */
    /* Adaptar el formulario a la experiencia elegida (prevención errores)*/
    /* ------------------------------------------------------------------ */
    function adaptarFormulario() {
        var exp = experienciaElegida();

        // Etiqueta de cantidad según la unidad
        var etiqueta = $("cantidad-etiqueta");
        var ayuda = $("cantidad-ayuda");
        if (exp && exp.dataset.unidad === "kit") {
            etiqueta.textContent = "Cantidad de kits";
            ayuda.textContent = "Cada kit es para hasta 4 personas. Entre 1 y " + CANTIDAD_MAXIMA + " por reserva.";
        } else {
            etiqueta.textContent = "Cantidad de personas";
            ayuda.textContent = "Entre " + CANTIDAD_MINIMA + " y " + CANTIDAD_MAXIMA + " por reserva.";
        }

        // Los adicionales que no aplican a la experiencia se deshabilitan y explican por qué
        adicionales.forEach(function (extra) {
            var textoAyuda = $(extra.id + "-ayuda");
            var solo = extra.dataset.solo ? extra.dataset.solo.split(" ") : null;
            var disponible = !solo || !exp || solo.indexOf(exp.value) !== -1;

            extra.disabled = !disponible;
            if (!disponible) {
                extra.checked = false;
                textoAyuda.textContent = "No disponible para la experiencia elegida (" + exp.dataset.nombre + ").";
            } else {
                textoAyuda.textContent = textoAyuda.dataset.original;
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Total en vivo                                                      */
    /* ------------------------------------------------------------------ */
    function dibujarTotal() {
        var pedido = calcularPedido();
        var lista = $("total-lineas");
        var vacio = $("total-vacio");

        lista.textContent = "";

        if (!pedido.lineas.length) {
            lista.hidden = true;
            vacio.hidden = false;
            vacio.textContent = !pedido.experiencia
                ? "Elegí una experiencia e ingresá la cantidad para ver el total."
                : "Ingresá una cantidad entre " + CANTIDAD_MINIMA + " y " + CANTIDAD_MAXIMA + " para ver el total.";
            $("total-usd").textContent = "—";
            $("total-ars").textContent = "—";
            return;
        }

        vacio.hidden = true;
        lista.hidden = false;

        pedido.lineas.forEach(function (l) {
            var item = document.createElement("li");
            item.className = "flex flex-wrap justify-between gap-x-4";
            var izquierda = document.createElement("span");
            izquierda.textContent = l.concepto + " (" + l.cantidad + " × " + enUSD(l.unitarioCentavos) + ")";
            var derecha = document.createElement("span");
            derecha.textContent = enUSD(l.subtotalCentavos);
            item.appendChild(izquierda);
            item.appendChild(derecha);
            lista.appendChild(item);
        });

        $("total-usd").textContent = enUSD(pedido.totalUSDCentavos);
        $("total-ars").textContent = pedido.totalARSCentavos === null ? "…" : enARS(pedido.totalARSCentavos);

        anunciarTotal(pedido);
    }

    // Aviso para lectores de pantalla, con demora para no hablar en cada tecla
    function anunciarTotal(pedido) {
        clearTimeout(temporizadorAnuncio);
        temporizadorAnuncio = setTimeout(function () {
            var texto = "Total: " + enUSD(pedido.totalUSDCentavos);
            if (pedido.totalARSCentavos !== null) {
                texto += ", aproximadamente " + enARS(pedido.totalARSCentavos) + " pesos argentinos.";
            }
            $("total-anuncio").textContent = texto;
        }, 700);
    }

    /* ------------------------------------------------------------------ */
    /* Cotización del dólar                                               */
    /* ------------------------------------------------------------------ */
    function textoCotizacion(c) {
        var detalle =
            "Tipo de cambio: 1 USD = " + formatoARS.format(c.venta) +
            " · Fuente: " + c.fuente +
            " · " + (c.origen === "respaldo" ? "Fecha de referencia: " : "Actualizado: ") +
            formatearFechaCotizacion(c.fecha);

        if (c.origen === "api") return detalle;
        if (c.origen === "cache") {
            return "⚠ No pudimos consultar la cotización en línea. Usamos la última que guardó este navegador. " + detalle;
        }
        return "⚠ No pudimos consultar la cotización en línea. Usamos un valor de respaldo que puede no estar actualizado. " + detalle;
    }

    function mostrarCotizacion() {
        var info = $("cotizacion-info");
        info.textContent = textoCotizacion(cotizacion);
        info.removeAttribute("aria-busy");
        $("cotizacion-reintentar").hidden = cotizacion.origen === "api";
        dibujarTotal();
    }

    function leerCache() {
        try {
            var guardado = JSON.parse(localStorage.getItem(CLAVE_CACHE));
            if (guardado && isFinite(guardado.venta) && guardado.venta > 0) {
                return { venta: guardado.venta, fecha: guardado.fecha, fuente: guardado.fuente, origen: "cache" };
            }
        } catch (e) {
            /* sin localStorage o dato corrupto: se ignora */
        }
        return null;
    }

    function guardarCache(c) {
        try {
            localStorage.setItem(CLAVE_CACHE, JSON.stringify({ venta: c.venta, fecha: c.fecha, fuente: c.fuente }));
        } catch (e) {
            /* modo privado u otro bloqueo: no pasa nada */
        }
    }

    function pedirCotizacion() {
        var info = $("cotizacion-info");
        info.textContent = "Consultando la cotización del dólar…";
        info.setAttribute("aria-busy", "true");
        $("cotizacion-reintentar").hidden = true;

        var control = new AbortController();
        var corte = setTimeout(function () {
            control.abort();
        }, TIEMPO_MAXIMO_API_MS);

        return fetch(API_URL, { signal: control.signal, cache: "no-store", headers: { Accept: "application/json" } })
            .then(function (respuesta) {
                if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
                return respuesta.json();
            })
            .then(function (datos) {
                var venta = Number(datos.venta);
                if (!isFinite(venta) || venta <= 0) throw new Error("Cotización inválida");
                var c = {
                    venta: venta,
                    fecha: datos.fechaActualizacion || new Date().toISOString(),
                    fuente: FUENTE_API,
                    origen: "api"
                };
                guardarCache(c);
                return c;
            })
            .catch(function () {
                return leerCache() || COTIZACION_RESPALDO;
            })
            .then(function (c) {
                clearTimeout(corte);
                cotizacion = c;
                mostrarCotizacion();
            });
    }

    $("cotizacion-reintentar").addEventListener("click", pedirCotizacion);

    /* ------------------------------------------------------------------ */
    /* Validaciones                                                       */
    /* ------------------------------------------------------------------ */
    function reglaNombre(campo) {
        var v = campo.value.trim();
        var palabras = v.split(/\s+/).filter(Boolean);
        if (!v) return "Ingresá tu nombre y apellido.";
        if (palabras.length < 2) return "Ingresá tu nombre y tu apellido.";
        if (!/\p{L}/u.test(v)) return "El nombre debe incluir letras.";
        return "";
    }

    function reglaEmail(campo) {
        var v = campo.value.trim();
        if (!v) return "Ingresá tu correo electrónico.";
        if (!V.EMAIL.test(v)) return "El correo no parece válido. Revisá que tenga el formato nombre@dominio.com.";
        return "";
    }

    function reglaFecha(campo) {
        var v = campo.value;
        if (!v) return "Elegí la fecha de tu visita.";
        if (v < minimaFecha) return "La fecha tiene que ser posterior a hoy.";
        if (v > maximaFecha) return "Elegí una fecha dentro del próximo año.";
        return "";
    }

    function reglaParque(campo) {
        return campo.value ? "" : "Elegí un parque.";
    }

    function reglaExperiencia() {
        return experienciaElegida() ? "" : "Elegí una experiencia.";
    }

    function reglaCantidad(campo) {
        if (campo.validity.badInput) return "Ingresá solo números.";
        var texto = campo.value.trim();
        if (texto === "") return "Ingresá la cantidad.";
        if (!/^-?\d+$/.test(texto)) return "La cantidad tiene que ser un número entero, sin decimales.";
        var n = Number(texto);
        if (n < CANTIDAD_MINIMA) return "La cantidad mínima es " + CANTIDAD_MINIMA + ".";
        if (n > CANTIDAD_MAXIMA) {
            return "La cantidad máxima por reserva es " + CANTIDAD_MAXIMA + ". Para grupos más grandes, escribinos desde Contacto.";
        }
        return "";
    }

    var definiciones = [
        { campo: nombre, regla: reglaNombre },
        { campo: email, regla: reglaEmail },
        { campo: fecha, regla: reglaFecha },
        { campo: parque, regla: reglaParque },
        { campo: experiencia, regla: reglaExperiencia },
        { campo: cantidad, regla: reglaCantidad }
    ];

    definiciones.forEach(function (d) {
        V.vincular(d.campo, d.regla);
    });

    /* ------------------------------------------------------------------ */
    /* Eventos que recalculan el total                                    */
    /* ------------------------------------------------------------------ */
    radios.forEach(function (radio) {
        radio.addEventListener("change", function () {
            adaptarFormulario();
            dibujarTotal();
        });
    });
    adicionales.forEach(function (extra) {
        extra.addEventListener("change", dibujarTotal);
    });
    cantidad.addEventListener("input", dibujarTotal);

    /* ------------------------------------------------------------------ */
    /* Paso 1 -> 2: revisar                                               */
    /* ------------------------------------------------------------------ */
    function agregarDato(lista, termino, descripcion) {
        var contenedor = document.createElement("div");
        var dt = document.createElement("dt");
        dt.className = "font-bold text-[#6CC74E]";
        dt.textContent = termino;
        var dd = document.createElement("dd");
        dd.className = "break-words";
        dd.textContent = descripcion; // textContent: nunca interpreta HTML
        contenedor.appendChild(dt);
        contenedor.appendChild(dd);
        lista.appendChild(contenedor);
    }

    function celda(etiqueta, texto, clase) {
        var td = document.createElement(etiqueta);
        if (etiqueta === "th") td.scope = "row";
        td.className = clase;
        td.textContent = texto;
        return td;
    }

    function mostrarPaso(paso, titulo) {
        pasoFormulario.hidden = paso !== pasoFormulario;
        pasoResumen.hidden = paso !== pasoResumen;
        pasoConfirmacion.hidden = paso !== pasoConfirmacion;
        titulo.focus();
        paso.scrollIntoView({ block: "start" });
    }

    function datosDelPedido(pedido) {
        return [
            ["Nombre y apellido", nombre.value.trim()],
            ["Correo electrónico", email.value.trim()],
            ["Fecha de la visita", fechaLarga(fecha.value)],
            ["Parque", parque.value],
            ["Experiencia", pedido.experiencia.dataset.nombre],
            [pedido.experiencia.dataset.unidad === "kit" ? "Cantidad de kits" : "Cantidad de personas", String(pedido.cantidad)]
        ];
    }

    form.addEventListener("submit", function (evento) {
        evento.preventDefault();

        var conError = V.validarTodos(definiciones);
        V.mostrarResumen(resumenErrores, conError);
        if (conError.length) {
            V.enfocarPrimero(conError);
            return;
        }

        if (!cotizacion) {
            // Muy poco probable: la cotización todavía no llegó ni cayó al respaldo
            $("cotizacion-info").textContent = "Esperá un momento: todavía estamos consultando la cotización del dólar.";
            return;
        }

        var pedido = calcularPedido();
        // Se congela la cotización mostrada, para que el resumen y la confirmación coincidan
        pedidoRevisado = { pedido: pedido, cotizacion: cotizacion };

        var datos = $("resumen-datos");
        datos.textContent = "";
        datosDelPedido(pedido).forEach(function (par) {
            agregarDato(datos, par[0], par[1]);
        });

        var cuerpo = $("resumen-lineas");
        cuerpo.textContent = "";
        pedido.lineas.forEach(function (l) {
            var fila = document.createElement("tr");
            fila.className = "border-b border-[#5A8A6A]/50";
            fila.appendChild(celda("th", l.concepto, "py-2 pr-4 font-normal"));
            fila.appendChild(celda("td", String(l.cantidad), "py-2 pr-4 text-right"));
            fila.appendChild(celda("td", enUSD(l.unitarioCentavos), "py-2 pr-4 text-right"));
            fila.appendChild(celda("td", enUSD(l.subtotalCentavos), "py-2 text-right"));
            cuerpo.appendChild(fila);
        });

        $("resumen-total-usd").textContent = enUSD(pedido.totalUSDCentavos);
        $("resumen-total-ars").textContent = enARS(pedido.totalARSCentavos);
        $("resumen-cotizacion").textContent = textoCotizacion(cotizacion);

        mostrarPaso(pasoResumen, $("reserva-titulo-resumen"));
    });

    /* ------------------------------------------------------------------ */
    /* Paso 2: volver o confirmar                                         */
    /* ------------------------------------------------------------------ */
    $("reserva-editar").addEventListener("click", function () {
        mostrarPaso(pasoFormulario, $("reserva-titulo-formulario"));
    });

    function codigoDeReserva() {
        return "PV-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    }

    $("reserva-confirmar").addEventListener("click", function () {
        var boton = this;
        boton.disabled = true;
        boton.textContent = "Registrando…";

        setTimeout(function () {
            var pedido = pedidoRevisado.pedido;
            var cot = pedidoRevisado.cotizacion;

            var datos = $("confirmacion-datos");
            datos.textContent = "";
            agregarDato(datos, "Código de reserva (de ejemplo)", codigoDeReserva());
            datosDelPedido(pedido).forEach(function (par) {
                agregarDato(datos, par[0], par[1]);
            });
            agregarDato(datos, "Total en dólares", enUSD(pedido.totalUSDCentavos));
            agregarDato(datos, "Total estimado en pesos", enARS(pedido.totalARSCentavos) + " (1 USD = " + formatoARS.format(cot.venta) + ")");

            $("confirmacion-texto").textContent =
                "Gracias, " + nombre.value.trim() + ". Tu solicitud de " + pedido.experiencia.dataset.nombre.toLowerCase() +
                " en " + parque.value + " para el " + fechaLarga(fecha.value) + " pasó todas las validaciones.";

            boton.disabled = false;
            boton.textContent = "Confirmar reserva";
            mostrarPaso(pasoConfirmacion, $("reserva-titulo-confirmacion"));
        }, 800);
    });

    /* ------------------------------------------------------------------ */
    /* Paso 3: nueva reserva                                              */
    /* ------------------------------------------------------------------ */
    $("reserva-otra").addEventListener("click", function () {
        form.reset();
        definiciones.forEach(function (d) {
            V.limpiarError(d.campo);
        });
        V.mostrarResumen(resumenErrores, []);
        adaptarFormulario();
        dibujarTotal();
        pedidoRevisado = null;
        mostrarPaso(pasoFormulario, $("reserva-titulo-formulario"));
    });

    /* ------------------------------------------------------------------ */
    /* Inicio                                                             */
    /* ------------------------------------------------------------------ */
    // Permite llegar con ?experiencia=visita-guiada | taller | picnic (desde la portada)
    var preseleccion = new URLSearchParams(window.location.search).get("experiencia");
    if (preseleccion) {
        var radioInicial = form.querySelector('input[name="experiencia"][value="' + preseleccion.replace(/[^a-z-]/g, "") + '"]');
        if (radioInicial) radioInicial.checked = true;
    }

    adaptarFormulario();
    dibujarTotal();
    pedirCotizacion();
})();
