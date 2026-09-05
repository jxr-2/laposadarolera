// Teaser de próximas mesas en la home. Estas tarjetas son públicas:
// cualquiera puede abrir el detalle de una mesa desde acá, aunque no tenga cuenta.
document.addEventListener("DOMContentLoaded", async () => {
    await LPR.Auth.init();
    await LPR.Mesas.archivarVencidasAutomaticamente();

    const contenedor = document.getElementById("proximas-contenedor");
    const nota = document.getElementById("proximas-nota");
    if (!contenedor) return;

    const mesas = (await LPR.Mesas.listar()).slice(0, 3);

    if (mesas.length === 0) {
        contenedor.innerHTML = '<p class="empty-state">No hay mesas publicadas por el momento. ¡Volvé pronto!</p>';
        return;
    }

    contenedor.innerHTML = mesas
        .map((mesa) => {
            const disponibles = LPR.Mesas.cuposDisponibles(mesa);
            const llena = disponibles <= 0;
            const badgeClase = llena ? "badge-cupos--llena" : disponibles <= 2 ? "badge-cupos--pocos" : "badge-cupos";
            return `
                <a class="mesa-card" href="html/mesa_detalle.html?id=${mesa.id}">
                    <div class="mesa-card__top">
                        <h3>${mesa.nombreMesa}</h3>
                        <span class="badge badge-sistema">${mesa.sistema}</span>
                    </div>
                    <p class="mesa-card__desc">${mesa.descripcion}</p>
                    <div class="mesa-card__meta">
                        <span><strong>${LPR.UI.formatFecha(mesa.fecha)}</strong>${mesa.hora ? ` · ${mesa.hora}hs` : ""}</span>
                        <span class="badge ${badgeClase}">${llena ? "Sin cupos" : `${disponibles} cupos`}</span>
                    </div>
                </a>`;
        })
        .join("");

    if (!LPR.Auth.currentUser() && nota) nota.hidden = false;
});
