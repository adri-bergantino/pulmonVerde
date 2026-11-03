(function () {
    "use strict";

    var respuestas = null;
    var formulario = document.getElementById("chat-formulario");
    var entrada = document.getElementById("chat-entrada");
    var mensajes = document.getElementById("chat-mensajes");
    var sugerencias = document.querySelectorAll("[data-pregunta]");
    var estado = document.getElementById("chat-estado");

    function normalizar(texto) {
        return texto
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function agregarMensaje(texto, tipo) {
        var articulo = document.createElement("article");
        articulo.className = tipo === "usuario"
            ? "ml-10 max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#C4790A] px-4 py-3 text-black"
            : "mr-10 max-w-[85%] self-start rounded-2xl rounded-bl-md border border-[#5A8A6A] bg-[#1C3A28] px-4 py-3";

        var etiqueta = document.createElement("span");
        etiqueta.className = "mb-1 block text-xs font-bold text-[#6CC74E]";
        etiqueta.textContent = tipo === "usuario" ? "Vos" : "Verde";
        articulo.appendChild(etiqueta);

        var contenido = document.createElement("p");
        contenido.className = tipo === "usuario" ? "font-medium" : "";
        contenido.textContent = texto;
        articulo.appendChild(contenido);
        mensajes.appendChild(articulo);
        mensajes.scrollTop = mensajes.scrollHeight;
    }

    function buscarRespuesta(texto) {
        var consulta = normalizar(texto);
        var mejorCoincidencia = null;
        var mayorPuntaje = 0;

        respuestas.respuestas.forEach(function (item) {
            var puntaje = 0;
            item.palabras.forEach(function (palabra) {
                var clave = normalizar(palabra);
                if (consulta === clave || consulta.indexOf(clave) !== -1) {
                    puntaje += clave.length > 5 ? 3 : 2;
                }
            });
            if (puntaje > mayorPuntaje) {
                mayorPuntaje = puntaje;
                mejorCoincidencia = item;
            }
        });

        return mayorPuntaje > 0 ? mejorCoincidencia.respuesta : respuestas.default;
    }

    function enviar(texto) {
        var consulta = texto.trim();
        if (!consulta || !respuestas) return;

        agregarMensaje(consulta, "usuario");
        entrada.value = "";
        entrada.disabled = true;

        estado.textContent = "Verde está escribiendo…";
        estado.classList.remove("opacity-0");

        window.setTimeout(function () {
            agregarMensaje(buscarRespuesta(consulta), "asistente");
            entrada.disabled = false;
            estado.textContent = "";
            estado.classList.add("opacity-0");
            entrada.focus();
        }, 450);
    }

    fetch("chat.json", { cache: "no-store" })
        .then(function (respuesta) {
            if (!respuesta.ok) throw new Error("No se pudo cargar chat.json");
            return respuesta.json();
        })
        .then(function (datos) {
            respuestas = datos;
            agregarMensaje(datos.bienvenida, "asistente");
            estado.textContent = "Asistente listo";
            window.setTimeout(function () {
                estado.classList.add("opacity-0");
            }, 1800);
        })
        .catch(function () {
            estado.textContent = "No se pudo iniciar el chat.";
            estado.classList.remove("opacity-0");
        });

    formulario.addEventListener("submit", function (evento) {
        evento.preventDefault();
        enviar(entrada.value);
    });

    sugerencias.forEach(function (boton) {
        boton.addEventListener("click", function () {
            enviar(boton.dataset.pregunta);
        });
    });
})();
