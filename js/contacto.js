/*
 * Formulario de contacto (simulación).
 * Valida cada campo, muestra errores debajo de cada uno y, si todo está bien,
 * simula el envío y muestra una confirmación que aclara que es una simulación.
 * Depende de js/validacion.js.
 */
(function () {
    "use strict";

    var form = document.getElementById("formulario-contacto");
    if (!form || !window.Validacion) return;

    var V = window.Validacion;
    var panelFormulario = document.getElementById("contacto-formulario");
    var panelConfirmacion = document.getElementById("contacto-confirmacion");
    var resumenErrores = document.getElementById("contacto-resumen-errores");
    var botonEnviar = document.getElementById("contacto-enviar");

    var nombre = document.getElementById("nombre");
    var email = document.getElementById("email");
    var motivo = document.getElementById("motivo");
    var mensaje = document.getElementById("mensaje");
    var contador = document.getElementById("mensaje-contador");

    var MIN_MENSAJE = 10;

    // Reglas: devuelven el mensaje de error, o "" si el campo está bien
    function reglaNombre(campo) {
        var v = campo.value.trim();
        if (!v) return "Ingresá tu nombre.";
        if (v.length < 2) return "El nombre debe tener al menos 2 letras.";
        if (!/\p{L}/u.test(v)) return "El nombre debe incluir letras.";
        return "";
    }

    function reglaEmail(campo) {
        var v = campo.value.trim();
        if (!v) return "Ingresá tu correo electrónico.";
        if (!V.EMAIL.test(v)) return "El correo no parece válido. Revisá que tenga el formato nombre@dominio.com.";
        return "";
    }

    function reglaMotivo(campo) {
        return campo.value ? "" : "Elegí el motivo de tu consulta.";
    }

    function reglaMensaje(campo) {
        var v = campo.value.trim();
        if (!v) return "Escribí tu mensaje.";
        if (v.length < MIN_MENSAJE) {
            return "Contanos un poco más: el mensaje debe tener al menos " + MIN_MENSAJE + " caracteres (ahora tiene " + v.length + ").";
        }
        return "";
    }

    var definiciones = [
        { campo: nombre, regla: reglaNombre },
        { campo: email, regla: reglaEmail },
        { campo: motivo, regla: reglaMotivo },
        { campo: mensaje, regla: reglaMensaje }
    ];

    definiciones.forEach(function (d) {
        V.vincular(d.campo, d.regla);
    });

    // Contador de caracteres
    mensaje.addEventListener("input", function () {
        contador.textContent = mensaje.value.length;
    });

    form.addEventListener("submit", function (evento) {
        evento.preventDefault();

        var conError = V.validarTodos(definiciones);
        V.mostrarResumen(resumenErrores, conError);

        if (conError.length) {
            V.enfocarPrimero(conError);
            return;
        }

        // Estado del sistema visible: botón ocupado mientras se "envía"
        botonEnviar.disabled = true;
        botonEnviar.textContent = "Enviando…";
        botonEnviar.setAttribute("aria-busy", "true");

        setTimeout(function () {
            mostrarConfirmacion();
            botonEnviar.disabled = false;
            botonEnviar.textContent = "Enviar consulta";
            botonEnviar.removeAttribute("aria-busy");
        }, 900);
    });

    function agregarDato(lista, termino, descripcion) {
        var contenedor = document.createElement("div");
        var dt = document.createElement("dt");
        dt.className = "font-bold text-[#6CC74E]";
        dt.textContent = termino;
        var dd = document.createElement("dd");
        dd.className = "whitespace-pre-line break-words";
        dd.textContent = descripcion; // textContent: nunca interpreta HTML
        contenedor.appendChild(dt);
        contenedor.appendChild(dd);
        lista.appendChild(contenedor);
    }

    function mostrarConfirmacion() {
        var datos = document.getElementById("contacto-confirmacion-datos");
        datos.textContent = "";
        agregarDato(datos, "Nombre", nombre.value.trim());
        agregarDato(datos, "Correo electrónico", email.value.trim());
        agregarDato(datos, "Motivo", motivo.value);
        agregarDato(datos, "Mensaje", mensaje.value.trim());

        document.getElementById("contacto-confirmacion-texto").textContent =
            "Gracias, " + nombre.value.trim() + ". Tu consulta sobre «" + motivo.value + "» pasó la validación correctamente.";

        panelFormulario.hidden = true;
        panelConfirmacion.hidden = false;
        document.getElementById("contacto-confirmacion-titulo").focus();
    }

    // Volver a empezar
    document.getElementById("contacto-otra").addEventListener("click", function () {
        form.reset();
        contador.textContent = "0";
        definiciones.forEach(function (d) {
            V.limpiarError(d.campo);
        });
        V.mostrarResumen(resumenErrores, []);
        panelConfirmacion.hidden = true;
        panelFormulario.hidden = false;
        nombre.focus();
    });
})();
