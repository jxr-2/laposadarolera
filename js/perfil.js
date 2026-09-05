document.addEventListener("DOMContentLoaded", async () => {
    await LPR.Auth.init();
    const user = LPR.Auth.requireLogin("login.html");
    if (!user) return;

    document.getElementById("perfil-avatar").textContent = LPR.UI.iniciales(user.apodo || user.nombre);
    document.getElementById("perfil-nombre").textContent = user.apodo || user.nombre;
    document.getElementById("perfil-rol").textContent = user.rol === "admin" ? "Administrador/a" : "Usuario/a registrado/a";

    document.getElementById("pf-nombre").value = user.nombre;
    document.getElementById("pf-apodo").value = user.apodo || "";
    document.getElementById("pf-email").value = user.email;
    document.getElementById("pf-telefono").value = user.telefono || "";
    document.getElementById("pf-bio").value = user.bio || "";
    document.getElementById("pf-narrador").checked = !!user.narrador;

    document.getElementById("form-datos").addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById("error-datos");
        const res = await LPR.Auth.updateCurrentUser({
            nombre: document.getElementById("pf-nombre").value.trim(),
            apodo: document.getElementById("pf-apodo").value.trim(),
            email: document.getElementById("pf-email").value.trim(),
            telefono: document.getElementById("pf-telefono").value.trim(),
            bio: document.getElementById("pf-bio").value.trim(),
            narrador: document.getElementById("pf-narrador").checked,
        });
        if (!res.ok) {
            errorEl.textContent = res.error;
            errorEl.hidden = false;
            return;
        }
        errorEl.hidden = true;
        LPR.UI.toast("Datos actualizados.", "success");
        LPR.Nav.render();
        document.getElementById("perfil-nombre").textContent = res.user.apodo || res.user.nombre;
        document.getElementById("perfil-avatar").textContent = LPR.UI.iniciales(res.user.apodo || res.user.nombre);
    });

    document.getElementById("form-pass").addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById("error-pass");
        const okEl = document.getElementById("ok-pass");
        okEl.hidden = true;
        const res = await LPR.Auth.cambiarPassword(
            document.getElementById("pass-actual").value,
            document.getElementById("pass-nueva").value
        );
        if (!res.ok) {
            errorEl.textContent = res.error;
            errorEl.hidden = false;
            return;
        }
        errorEl.hidden = true;
        okEl.textContent = "Contraseña actualizada.";
        okEl.hidden = false;
        e.target.reset();
    });

    document.getElementById("btn-logout-perfil").addEventListener("click", () => {
        LPR.Auth.logout();
        LPR.UI.toast("Sesión cerrada.", "info");
        setTimeout(() => (location.href = "../index.html"), 350);
    });

    await renderInscripciones();
    if (user.rol === "admin") await renderMesasCreadas();

    async function renderInscripciones() {
        const host = document.getElementById("lista-inscripciones");
        const inscripciones = await LPR.Mesas.inscripcionesDeUsuario(user.id);
        if (inscripciones.length === 0) {
            host.innerHTML = '<p class="empty-state">Todavía no te inscribiste a ninguna mesa.</p>';
            return;
        }
        const filas = await Promise.all(
            inscripciones.map(async (i) => {
                const mesa = await LPR.Mesas.obtener(i.mesaId);
                if (!mesa) return "";
                return `
                    <div class="list-row">
                        <div>
                            <div class="list-row__title"><a href="mesa_detalle.html?id=${mesa.id}" style="color:inherit;">${mesa.nombreMesa}</a></div>
                            <div class="list-row__meta">${LPR.UI.formatFecha(mesa.fecha)} · ${mesa.sistema}</div>
                        </div>
                        <button class="link-danger" data-cancelar="${i.id}">Cancelar</button>
                    </div>`;
            })
        );
        host.innerHTML = filas.join("");
        host.querySelectorAll("[data-cancelar]").forEach((btn) =>
            btn.addEventListener("click", async () => {
                const ok = await LPR.UI.confirmar("¿Cancelar esta inscripción?");
                if (!ok) return;
                await LPR.Mesas.cancelarInscripcion(btn.dataset.cancelar);
                LPR.UI.toast("Inscripción cancelada.", "info");
                renderInscripciones();
            })
        );
    }

    async function renderMesasCreadas() {
        const bloque = document.getElementById("bloque-mesas-creadas");
        const host = document.getElementById("lista-mesas-creadas");
        const mesas = await LPR.Mesas.mesasCreadasPor(user.id);
        if (mesas.length === 0) return;
        bloque.hidden = false;
        host.innerHTML = mesas
            .map(
                (m) => `
                <a class="mesa-card" href="mesa_detalle.html?id=${m.id}">
                    <div class="mesa-card__top">
                        <h3>${m.nombreMesa}</h3>
                        <span class="badge badge-estado--${m.estado}">${m.estado}</span>
                    </div>
                    <div class="mesa-card__meta"><span>${LPR.UI.formatFecha(m.fecha)}</span><span>${LPR.Mesas.cuposOcupados(m)}/${m.cupos} cupos</span></div>
                </a>`
            )
            .join("");
    }
});
