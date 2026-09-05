// LPR.UI: helpers de interfaz compartidos (toasts, confirmaciones, formato).
window.LPR = window.LPR || {};

(function () {
    function ensureToastHost() {
        let host = document.getElementById("lpr-toast-host");
        if (!host) {
            host = document.createElement("div");
            host.id = "lpr-toast-host";
            host.className = "toast-host";
            document.body.appendChild(host);
        }
        return host;
    }

    function toast(mensaje, tipo = "info", duracion = 3200) {
        const host = ensureToastHost();
        const el = document.createElement("div");
        el.className = `toast toast--${tipo}`;
        el.textContent = mensaje;
        host.appendChild(el);
        requestAnimationFrame(() => el.classList.add("toast--visible"));
        setTimeout(() => {
            el.classList.remove("toast--visible");
            setTimeout(() => el.remove(), 250);
        }, duracion);
    }

    function confirmar(mensaje) {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "modal-overlay";
            overlay.innerHTML = `
                <div class="modal-box">
                    <p>${mensaje}</p>
                    <div class="modal-actions">
                        <button class="btn-secondary" data-action="no">Cancelar</button>
                        <button class="btn-primary" data-action="si">Confirmar</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add("modal-overlay--visible"));
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) cerrar(false);
                const action = e.target.getAttribute("data-action");
                if (action) cerrar(action === "si");
            });
            function cerrar(valor) {
                overlay.classList.remove("modal-overlay--visible");
                setTimeout(() => overlay.remove(), 200);
                resolve(valor);
            }
        });
    }

    function formatFecha(iso, opciones) {
        if (!iso) return "";
        const d = new Date(`${iso}T00:00:00`);
        return d.toLocaleDateString("es-AR", opciones || { day: "2-digit", month: "short", year: "numeric" });
    }

    function iniciales(nombre) {
        return (nombre || "?")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0].toUpperCase())
            .join("");
    }

    function copiarPortapapeles(texto) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(texto);
        }
        const ta = document.createElement("textarea");
        ta.value = texto;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } finally { ta.remove(); }
        return Promise.resolve();
    }

    function qs(nombre) {
        return new URLSearchParams(location.search).get(nombre);
    }

    LPR.UI = { toast, confirmar, formatFecha, iniciales, copiarPortapapeles, qs };
})();
