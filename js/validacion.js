/*
 * Utilidades de validación compartidas por los formularios (contacto y reserva).
 *
 * Patrón de cada campo en el HTML:
 *   <label for="x">…</label>
 *   <input id="x" aria-describedby="x-ayuda x-error">
 *   <p id="x-error" hidden></p>        <- acá se escribe el mensaje de error
 *
 * Cuando hay error se hace TODO esto a la vez (no depende solo del color):
 *   1. aria-invalid="true" en el campo (lo anuncian los lectores de pantalla)
 *   2. mensaje de texto con ícono ⚠ debajo del campo (referenciado por aria-describedby)
 *   3. borde del campo en otro color (estilo aria-invalid: en Tailwind)
 *
 * Se expone como global (window.Validacion) y no como módulo ES, para que el
 * sitio también funcione abierto con doble clic (file://).
 */
(function (global) {
    "use strict";

    var Validacion = {};

    // Formato básico nombre@dominio.ext
    Validacion.EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function esControl(campo) {
        return /^(INPUT|SELECT|TEXTAREA)$/.test(campo.tagName);
    }

    function elementoError(campo) {
        return document.getElementById(campo.id + "-error");
    }

    // Texto de la etiqueta del campo (label o legend), para el resumen de errores
    function nombreDelCampo(campo) {
        var etiqueta = document.querySelector('label[for="' + campo.id + '"]');
        if (!etiqueta && campo.tagName === "FIELDSET") etiqueta = campo.querySelector("legend");
        return etiqueta ? etiqueta.textContent.replace(/\s+/g, " ").trim() : campo.id;
    }

    Validacion.estaEnError = function (campo) {
        return campo.getAttribute("aria-invalid") === "true" || campo.dataset.invalid === "true";
    };

    Validacion.mostrarError = function (campo, mensaje) {
        var contenedor = elementoError(campo);
        if (contenedor) {
            contenedor.textContent = "";
            var icono = document.createElement("span");
            icono.setAttribute("aria-hidden", "true");
            icono.textContent = "⚠";
            var texto = document.createElement("span");
            texto.textContent = mensaje;
            contenedor.appendChild(icono);
            contenedor.appendChild(texto);
            contenedor.hidden = false;
        }
        if (esControl(campo)) {
            campo.setAttribute("aria-invalid", "true");
        } else {
            campo.dataset.invalid = "true"; // fieldset de radios/checkbox
        }
    };

    Validacion.limpiarError = function (campo) {
        var contenedor = elementoError(campo);
        if (contenedor) {
            contenedor.textContent = "";
            contenedor.hidden = true;
        }
        campo.removeAttribute("aria-invalid");
        delete campo.dataset.invalid;
    };

    /**
     * Valida un campo con su regla. La regla recibe el campo y devuelve
     * un mensaje de error (string) o "" si está bien.
     * Devuelve true si el campo es válido.
     */
    Validacion.validarCampo = function (campo, regla) {
        var mensaje = regla(campo);
        if (mensaje) {
            Validacion.mostrarError(campo, mensaje);
            return false;
        }
        Validacion.limpiarError(campo);
        return true;
    };

    /**
     * Valida un grupo de campos { campo, regla }.
     * Devuelve la lista de campos con error (vacía si todo está bien).
     */
    Validacion.validarTodos = function (definiciones) {
        return definiciones
            .filter(function (d) {
                return !Validacion.validarCampo(d.campo, d.regla);
            })
            .map(function (d) {
                return d.campo;
            });
    };

    /**
     * Valida al salir del campo (blur) y, una vez que hubo un error,
     * revalida mientras la persona escribe para que el error desaparezca
     * apenas lo corrige (reconocer y recuperarse de errores).
     */
    Validacion.vincular = function (campo, regla) {
        if (esControl(campo)) {
            campo.addEventListener("blur", function () {
                Validacion.validarCampo(campo, regla);
            });
        }
        ["input", "change"].forEach(function (evento) {
            campo.addEventListener(evento, function () {
                if (Validacion.estaEnError(campo)) Validacion.validarCampo(campo, regla);
            });
        });
    };

    /**
     * Resumen de errores arriba del formulario (role="alert" en el HTML).
     * Con campos vacíos lo limpia.
     */
    Validacion.mostrarResumen = function (contenedor, camposConError) {
        contenedor.textContent = "";
        if (!camposConError.length) {
            contenedor.hidden = true;
            return;
        }
        var titulo = document.createElement("p");
        titulo.className = "font-bold";
        titulo.textContent =
            camposConError.length === 1
                ? "Hay 1 dato para corregir:"
                : "Hay " + camposConError.length + " datos para corregir:";
        var lista = document.createElement("ul");
        lista.className = "list-disc pl-6 mt-2";
        camposConError.forEach(function (campo) {
            var item = document.createElement("li");
            item.textContent = nombreDelCampo(campo);
            lista.appendChild(item);
        });
        contenedor.appendChild(titulo);
        contenedor.appendChild(lista);
        contenedor.hidden = false;
    };

    // Lleva el foco al primer campo con error (para teclado y lectores de pantalla)
    Validacion.enfocarPrimero = function (campos) {
        var primero = campos[0];
        if (!primero) return;
        var destino = primero;
        if (primero.tagName === "FIELDSET") {
            destino = primero.querySelector("input") || primero;
        }
        destino.focus();
    };

    global.Validacion = Validacion;
})(window);
