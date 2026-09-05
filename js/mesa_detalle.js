document.addEventListener("DOMContentLoaded", async () => {
    await LPR.Auth.init();
    await LPR.Mesas.archivarVencidasAutomaticamente();
    const root = document.getElementById("page-root");
    const id = LPR.UI.qs("id");

    if (!id) {
        root.innerHTML = '<p class="empty-state">No encontramos esa mesa. Puede que el link esté vencido o la mesa ya no exista.</p>';
        return;
    }

    await render();

    async function render() {
        const mesa = await LPR.Mesas.obtener(id);
        if (!mesa) {
            root.innerHTML = '<p class="empty-state">No encontramos esa mesa. Puede que el link esté vencido o la mesa ya no exista.</p>';
            return;
        }

        const user = LPR.Auth.currentUser();
        const disponibles = LPR.Mesas.cuposDisponibles(mesa);
        const llena = LPR.Mesas.estaLlena(mesa);
        const pct = Math.round((LPR.Mesas.cuposOcupados(mesa) / mesa.cupos) * 100);
        const badgeClase = llena ? "badge-cupos--llena" : disponibles <= 2 ? "badge-cupos--pocos" : "badge-cupos";

        root.innerHTML = `
            <div class="page-header">
                <p class="eyebrow">${mesa.estado === "archivada" ? "Mesa archivada" : "Domingo de rol"}</p>
                <h1>${mesa.nombreMesa}</h1>
                <p>${mesa.enfoque || ""}</p>
            </div>
            <div class="detalle-grid">
                <div>
                    <span class="badge badge-sistema">${mesa.sistema}</span>
                    <span class="badge badge-estado--${mesa.estado}">${mesa.estado}</span>
                    <div class="detalle-meta">
                        <span><strong>Fecha:</strong> ${LPR.UI.formatFecha(mesa.fecha)}${mesa.hora ? ` · ${mesa.hora}hs` : ""}</span>
                        <span><strong>Duración:</strong> ${mesa.duracion}</span>
                        <span><strong>Experiencia:</strong> ${mesa.experiencia}</span>
                        <span><strong>Lugar:</strong> ${mesa.lugar || "La Posada Rolera"}</span>
                    </div>
                    <p class="mesa-card__desc" style="font-size:16px;">${mesa.descripcion}</p>
                    <div>${(mesa.keywords || []).map((k) => `<span class="keyword-pill">#${k}</span>`).join("")}</div>
                </div>
                <div id="panel-inscripcion"></div>
            </div>
            <div id="panel-admin"></div>
        `;

        const panel = document.getElementById("panel-inscripcion");
        panel.innerHTML = `
            <div class="panel">
                <h2>Cupos</h2>
                <div class="cupos-bar" style="margin-bottom:10px;"><div class="cupos-bar__fill" style="width:${pct}%"></div></div>
                <p class="mesa-card__meta"><span class="badge ${badgeClase}">${llena ? "Sin cupos disponibles" : `${disponibles} de ${mesa.cupos} cupos libres`}</span></p>
                <div id="accion-inscripcion" style="margin-top:18px;"></div>
            </div>`;

        await renderAccionInscripcion(mesa, user, llena);
        if (user && user.rol === "admin") await renderPanelAdmin(mesa);
    }

    async function renderAccionInscripcion(mesa, user, llena) {
        const host = document.getElementById("accion-inscripcion");

        if (mesa.estado !== "publicada") {
            host.innerHTML = '<p class="form-hint">Esta mesa ya no está activa.</p>';
            return;
        }

        if (user) {
            const yaInscripto = await LPR.Mesas.yaInscripto(mesa.id, user.id);
            if (yaInscripto) {
                host.innerHTML = `
                    <p class="form-hint">Ya estás inscripto/a en esta mesa.</p>
                    <button class="btn-tertiary btn-block" id="btn-cancelar">Cancelar mi inscripción</button>`;
                document.getElementById("btn-cancelar").addEventListener("click", async () => {
                    const ok = await LPR.UI.confirmar("¿Cancelar tu inscripción a esta mesa?");
                    if (!ok) return;
                    const insc = (await LPR.Mesas.inscripcionesDeUsuario(user.id)).find((i) => i.mesaId === mesa.id);
                    if (insc) await LPR.Mesas.cancelarInscripcion(insc.id);
                    LPR.UI.toast("Inscripción cancelada.", "info");
                    render();
                });
                return;
            }
            if (llena) {
                host.innerHTML = '<button class="btn-tertiary btn-block" disabled>Mesa completa</button>';
                return;
            }
            host.innerHTML = '<button class="btn-primary btn-block" id="btn-inscribir">Inscribirme</button>';
            document.getElementById("btn-inscribir").addEventListener("click", async () => {
                const res = await LPR.Mesas.inscribirConCuenta(mesa.id, user);
                if (!res.ok) return LPR.UI.toast(res.error, "error");
                LPR.UI.toast("¡Listo! Quedaste inscripto/a.", "success");
                render();
            });
            return;
        }

        // Invitado sin cuenta: solo puede inscribirse a ESTA mesa con nombre + contacto.
        if (llena) {
            host.innerHTML = '<button class="btn-tertiary btn-block" disabled>Mesa completa</button>';
            return;
        }
        host.innerHTML = `
            <form id="form-invitado">
                <div class="field">
                    <label for="inv-nombre">Tu nombre</label>
                    <input type="text" id="inv-nombre" required>
                </div>
                <div class="field">
                    <label for="inv-contacto">Tu contacto (celular)</label>
                    <input type="tel" id="inv-contacto" required>
                    <small>Un admin te va a reconfirmar la inscripción si no te conoce.</small>
                </div>
                <button type="submit" class="btn-primary btn-block">Inscribirme sin cuenta</button>
            </form>
            <p class="gate-note">¿Querés guardar tu historial y ver todas las mesas? <a href="login.html">Creá una cuenta →</a></p>
        `;
        document.getElementById("form-invitado").addEventListener("submit", async (e) => {
            e.preventDefault();
            const nombre = document.getElementById("inv-nombre").value;
            const contacto = document.getElementById("inv-contacto").value;
            const res = await LPR.Mesas.inscribirComoInvitado(mesa.id, { nombre, contacto });
            if (!res.ok) return LPR.UI.toast(res.error, "error");
            LPR.UI.toast("¡Listo! Un admin va a confirmar tu lugar a la brevedad.", "success");
            render();
        });
    }

    async function renderPanelAdmin(mesa) {
        const host = document.getElementById("panel-admin");
        const inscriptos = await LPR.Mesas.inscripcionesDeMesa(mesa.id);
        host.innerHTML = `
            <div class="section-block">
                <div class="section-block__head">
                    <h2>Panel de administración</h2>
                    <div class="table-actions">
                        <button id="btn-instagram">Generar texto Instagram</button>
                        <button id="btn-editar">Editar mesa</button>
                        ${mesa.estado === "publicada" ? '<button id="btn-archivar">Archivar</button>' : '<button id="btn-republicar">Republicar</button>'}
                        <button id="btn-eliminar" class="danger">Eliminar</button>
                    </div>
                </div>
                <div class="panel">
                    <h2>Narrador (origen externo)</h2>
                    <p class="mesa-card__meta">
                        <span><strong>Nombre:</strong> ${mesa.origen?.nombreNarrador || "—"}</span>
                        <span><strong>Contacto:</strong> ${mesa.origen?.contactoNarrador || "—"}</span>
                    </p>
                </div>
                <div class="panel" style="margin-top:20px;">
                    <h2>Inscriptos (${inscriptos.length})</h2>
                    ${
                        inscriptos.length === 0
                            ? '<p class="empty-state">Todavía no hay inscriptos.</p>'
                            : `<div class="table-wrap"><table class="data-table"><thead><tr><th>Nombre</th><th>Contacto</th><th>Tipo</th><th>Estado</th><th></th></tr></thead><tbody>${inscriptos
                                  .map(
                                      (i) => `<tr>
                                <td>${i.nombre}</td>
                                <td>${i.contacto}</td>
                                <td>${i.tipo === "cuenta" ? "Cuenta" : "Invitado"}</td>
                                <td><span class="badge badge-estado--${i.estado}">${i.estado}</span></td>
                                <td class="table-actions">
                                    ${i.estado === "pendiente" ? `<button data-confirmar="${i.id}">Confirmar</button>` : ""}
                                    <button data-cancelar="${i.id}" class="danger">Quitar</button>
                                </td>
                            </tr>`
                                  )
                                  .join("")}</tbody></table></div>`
                    }
                </div>
            </div>
        `;

        document.getElementById("btn-instagram").addEventListener("click", () => {
            const texto = LPR.Mesas.generarTextoInstagram(mesa);
            LPR.UI.copiarPortapapeles(texto);
            LPR.UI.toast("Texto copiado al portapapeles.", "success");
        });
        document.getElementById("btn-editar").addEventListener("click", () => {
            location.href = `subir_mesa.html?id=${mesa.id}`;
        });
        const btnArchivar = document.getElementById("btn-archivar");
        if (btnArchivar) btnArchivar.addEventListener("click", async () => { await LPR.Mesas.archivar(mesa.id); LPR.UI.toast("Mesa archivada.", "info"); render(); });
        const btnRepublicar = document.getElementById("btn-republicar");
        if (btnRepublicar) btnRepublicar.addEventListener("click", async () => { await LPR.Mesas.republicar(mesa.id); LPR.UI.toast("Mesa republicada.", "success"); render(); });
        document.getElementById("btn-eliminar").addEventListener("click", async () => {
            const ok = await LPR.UI.confirmar("¿Eliminar esta mesa y todas sus inscripciones? Esta acción no se puede deshacer.");
            if (!ok) return;
            await LPR.Mesas.eliminar(mesa.id);
            LPR.UI.toast("Mesa eliminada.", "info");
            setTimeout(() => (location.href = "mesas_subidas.html"), 400);
        });
        host.querySelectorAll("[data-confirmar]").forEach((btn) =>
            btn.addEventListener("click", async () => { await LPR.Mesas.confirmarInscripcion(btn.dataset.confirmar); render(); })
        );
        host.querySelectorAll("[data-cancelar]").forEach((btn) =>
            btn.addEventListener("click", async () => {
                const ok = await LPR.UI.confirmar("¿Quitar a esta persona de la mesa?");
                if (!ok) return;
                await LPR.Mesas.cancelarInscripcion(btn.dataset.cancelar);
                render();
            })
        );
    }
});
