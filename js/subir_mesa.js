document.addEventListener("DOMContentLoaded", async () => {
    await LPR.Auth.init();
    const admin = LPR.Auth.requireAdmin("login.html");
    if (!admin) return;

    const idEdicion = LPR.UI.qs("id");
    const mesaExistente = idEdicion ? await LPR.Mesas.obtener(idEdicion) : null;

    if (idEdicion && !mesaExistente) {
        LPR.UI.toast("No encontramos esa mesa para editar.", "error");
    }

    if (mesaExistente) {
        document.getElementById("titulo-form").textContent = "Editar mesa";
        document.getElementById("btn-submit").textContent = "Guardar cambios";
        document.getElementById("nombreMesa").value = mesaExistente.nombreMesa;
        document.getElementById("sistema").value = mesaExistente.sistema;
        document.getElementById("duracion").value = mesaExistente.duracion;
        document.getElementById("experiencia").value = mesaExistente.experiencia;
        document.getElementById("descripcion").value = mesaExistente.descripcion;
        document.getElementById("enfoque").value = mesaExistente.enfoque || "";
        document.getElementById("keywords").value = (mesaExistente.keywords || []).join(", ");
        document.getElementById("players").value = mesaExistente.cupos;
        document.getElementById("dia").value = mesaExistente.fecha;
        document.getElementById("hora").value = mesaExistente.hora || "";
        document.getElementById("lugar").value = mesaExistente.lugar || "La Posada Rolera";
        document.getElementById("narradorNombre").value = mesaExistente.origen?.nombreNarrador || "";
        document.getElementById("narradorContacto").value = mesaExistente.origen?.contactoNarrador || "";
    }

    document.getElementById("form-mesa").addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById("form-error");
        errorEl.hidden = true;

        const cupos = parseInt(document.getElementById("players").value, 10);
        if (mesaExistente && cupos < LPR.Mesas.cuposOcupados(mesaExistente)) {
            errorEl.textContent = `No podés poner menos cupos (${cupos}) que inscriptos actuales (${LPR.Mesas.cuposOcupados(mesaExistente)}).`;
            errorEl.hidden = false;
            return;
        }

        const datos = {
            nombreMesa: document.getElementById("nombreMesa").value.trim(),
            sistema: document.getElementById("sistema").value.trim(),
            duracion: document.getElementById("duracion").value,
            experiencia: document.getElementById("experiencia").value,
            descripcion: document.getElementById("descripcion").value.trim(),
            enfoque: document.getElementById("enfoque").value.trim(),
            keywords: document.getElementById("keywords").value.split(",").map((k) => k.trim()).filter(Boolean),
            cupos,
            fecha: document.getElementById("dia").value,
            hora: document.getElementById("hora").value,
            lugar: document.getElementById("lugar").value.trim(),
            origen: {
                nombreNarrador: document.getElementById("narradorNombre").value.trim(),
                contactoNarrador: document.getElementById("narradorContacto").value.trim(),
            },
        };

        if (mesaExistente) {
            await LPR.Mesas.actualizar(mesaExistente.id, datos);
            LPR.UI.toast("Mesa actualizada.", "success");
            setTimeout(() => (location.href = `mesa_detalle.html?id=${mesaExistente.id}`), 350);
        } else {
            const config = await LPR.Mesas.obtenerConfig();
            const activas = (await LPR.Mesas.listar()).length;
            const seguir = async () => {
                const nueva = await LPR.Mesas.crear(datos, admin.id);
                LPR.UI.toast("¡Mesa publicada!", "success");
                setTimeout(() => (location.href = `mesa_detalle.html?id=${nueva.id}`), 350);
            };
            if (config.maxMesasActivas && activas >= config.maxMesasActivas) {
                const ok = await LPR.UI.confirmar(
                    `Ya hay ${activas} mesas activas (el objetivo de temporada es ${config.maxMesasActivas}). ¿Publicar de todos modos?`
                );
                if (ok) await seguir();
            } else {
                await seguir();
            }
        }
    });
});
