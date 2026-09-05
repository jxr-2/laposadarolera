document.addEventListener("DOMContentLoaded", async () => {
    await LPR.Auth.init();
    const admin = LPR.Auth.requireAdmin("login.html");
    if (!admin) return;
    await LPR.Mesas.archivarVencidasAutomaticamente();

    await renderStats();
    await renderConfig();
    await renderMesas();
    await renderPendientes();
    await renderUsuarios();
    wireRespaldo();

    async function renderStats() {
        const mesas = await LPR.Mesas.listar();
        const usuarios = await LPR.Auth.listarUsuarios();
        const inscripciones = await LPR.Mesas.todasInscripciones();
        const cuposTotales = mesas.reduce((acc, m) => acc + m.cupos, 0);
        const cuposOcupados = mesas.reduce((acc, m) => acc + LPR.Mesas.cuposOcupados(m), 0);
        document.getElementById("admin-stats").innerHTML = `
            <div class="stat-tile"><div class="stat-tile__value">${mesas.length}</div><div class="stat-tile__label">Mesas activas</div></div>
            <div class="stat-tile"><div class="stat-tile__value">${cuposOcupados}/${cuposTotales}</div><div class="stat-tile__label">Cupos ocupados</div></div>
            <div class="stat-tile"><div class="stat-tile__value">${usuarios.length}</div><div class="stat-tile__label">Usuarios registrados</div></div>
            <div class="stat-tile"><div class="stat-tile__value">${inscripciones.length}</div><div class="stat-tile__label">Inscripciones totales</div></div>
        `;
    }

    async function renderConfig() {
        const config = await LPR.Mesas.obtenerConfig();
        document.getElementById("cfg-temporada").value = config.temporada || "";
        document.getElementById("cfg-max").value = config.maxMesasActivas || "";
        document.getElementById("form-config").addEventListener("submit", async (e) => {
            e.preventDefault();
            await LPR.Mesas.guardarConfig({
                temporada: document.getElementById("cfg-temporada").value.trim(),
                maxMesasActivas: parseInt(document.getElementById("cfg-max").value, 10) || 0,
            });
            LPR.UI.toast("Configuración guardada.", "success");
        });
    }

    async function renderMesas() {
        const tbody = document.querySelector("#tabla-mesas tbody");
        const mesas = await LPR.Mesas.listar();
        tbody.innerHTML = mesas.length
            ? mesas
                  .map(
                      (m) => `
                    <tr>
                        <td class="wrap">${m.nombreMesa}</td>
                        <td>${m.sistema}</td>
                        <td>${LPR.UI.formatFecha(m.fecha)}</td>
                        <td>${LPR.Mesas.cuposOcupados(m)}/${m.cupos}</td>
                        <td><span class="badge badge-estado--${m.estado}">${m.estado}</span></td>
                        <td class="table-actions">
                            <button data-ver="${m.id}">Ver</button>
                            <button data-editar="${m.id}">Editar</button>
                            <button data-archivar="${m.id}">Archivar</button>
                        </td>
                    </tr>`
                  )
                  .join("")
            : '<tr><td colspan="6" class="empty-state">No hay mesas activas.</td></tr>';

        tbody.querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => (location.href = `mesa_detalle.html?id=${b.dataset.ver}`)));
        tbody.querySelectorAll("[data-editar]").forEach((b) => b.addEventListener("click", () => (location.href = `subir_mesa.html?id=${b.dataset.editar}`)));
        tbody.querySelectorAll("[data-archivar]").forEach((b) =>
            b.addEventListener("click", async () => {
                await LPR.Mesas.archivar(b.dataset.archivar);
                LPR.UI.toast("Mesa archivada.", "info");
                await renderMesas();
                await renderStats();
            })
        );
    }

    async function renderPendientes() {
        const tbody = document.querySelector("#tabla-pendientes tbody");
        const pendientes = (await LPR.Mesas.todasInscripciones()).filter((i) => i.estado === "pendiente");
        tbody.innerHTML = pendientes.length
            ? pendientes
                  .map(
                      (i) => `
                        <tr>
                            <td class="wrap">${i.mesaNombre}</td>
                            <td>${i.nombre}</td>
                            <td>${i.contacto}</td>
                            <td class="table-actions">
                                <button data-confirmar="${i.id}">Confirmar</button>
                                <button data-quitar="${i.id}" class="danger">Quitar</button>
                            </td>
                        </tr>`
                  )
                  .join("")
            : '<tr><td colspan="4" class="empty-state">No hay inscripciones pendientes de confirmar.</td></tr>';

        tbody.querySelectorAll("[data-confirmar]").forEach((b) =>
            b.addEventListener("click", async () => { await LPR.Mesas.confirmarInscripcion(b.dataset.confirmar); LPR.UI.toast("Inscripción confirmada.", "success"); await renderPendientes(); })
        );
        tbody.querySelectorAll("[data-quitar]").forEach((b) =>
            b.addEventListener("click", async () => { await LPR.Mesas.cancelarInscripcion(b.dataset.quitar); await renderPendientes(); await renderStats(); })
        );
    }

    async function renderUsuarios() {
        const tbody = document.querySelector("#tabla-usuarios tbody");
        const usuarios = await LPR.Auth.listarUsuarios();
        tbody.innerHTML = usuarios
            .map(
                (u) => `
                <tr>
                    <td class="wrap">${u.nombre}${u.id === admin.id ? " (vos)" : ""}</td>
                    <td>${u.email}</td>
                    <td><span class="badge ${u.rol === "admin" ? "badge-cupos" : "badge-sistema"}">${u.rol}</span></td>
                    <td class="table-actions">
                        ${
                            u.id === admin.id
                                ? ""
                                : u.rol === "admin"
                                ? `<button data-degradar="${u.id}">Quitar admin</button>`
                                : `<button data-promover="${u.id}">Hacer admin</button>`
                        }
                        ${u.id === admin.id ? "" : `<button data-eliminar="${u.id}" class="danger">Eliminar</button>`}
                    </td>
                </tr>`
            )
            .join("");

        tbody.querySelectorAll("[data-promover]").forEach((b) => b.addEventListener("click", () => cambiarRol(b.dataset.promover, "admin")));
        tbody.querySelectorAll("[data-degradar]").forEach((b) => b.addEventListener("click", () => cambiarRol(b.dataset.degradar, "usuario")));
        tbody.querySelectorAll("[data-eliminar]").forEach((b) =>
            b.addEventListener("click", async () => {
                const ok = await LPR.UI.confirmar("¿Eliminar esta cuenta? Sus inscripciones también se van a quitar.");
                if (!ok) return;
                await LPR.Auth.eliminarUsuario(b.dataset.eliminar);
                LPR.UI.toast("Cuenta eliminada.", "info");
                await renderUsuarios();
                await renderStats();
            })
        );
    }

    async function cambiarRol(userId, rol) {
        await LPR.Auth.cambiarRol(userId, rol);
        LPR.UI.toast("Rol actualizado.", "success");
        await renderUsuarios();
    }

    function wireRespaldo() {
        document.getElementById("btn-exportar").addEventListener("click", async () => {
            const backup = {
                exportadoEn: new Date().toISOString(),
                usuarios: await LPR.Auth.listarUsuarios(),
                mesas: await LPR.Mesas.listar({ soloPublicadas: false }),
                inscripciones: await LPR.Mesas.todasInscripciones(),
                config: await LPR.Mesas.obtenerConfig(),
            };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `posada-rolera-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        });
    }
});
