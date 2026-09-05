document.addEventListener("DOMContentLoaded", async () => {
    await LPR.Auth.init();
    if (!LPR.Auth.requireLogin("login.html")) return;
    await LPR.Mesas.archivarVencidasAutomaticamente();

    const contenedor = document.getElementById("contenedorMesas");
    const fTexto = document.getElementById("f-texto");
    const fSistema = document.getElementById("f-sistema");
    const fExperiencia = document.getElementById("f-experiencia");
    const fDisponibilidad = document.getElementById("f-disponibilidad");

    const todasLasMesas = await LPR.Mesas.listar();

    function poblarSistemas(mesas) {
        const sistemas = [...new Set(mesas.map((m) => m.sistema))].sort();
        fSistema.innerHTML =
            '<option value="">Todos los sistemas</option>' +
            sistemas.map((s) => `<option value="${s}">${s}</option>`).join("");
    }

    function tarjeta(mesa) {
        const disponibles = LPR.Mesas.cuposDisponibles(mesa);
        const llena = disponibles <= 0;
        const badgeClase = llena ? "badge-cupos--llena" : disponibles <= 2 ? "badge-cupos--pocos" : "badge-cupos";
        return `
            <a class="mesa-card" href="mesa_detalle.html?id=${mesa.id}">
                <div class="mesa-card__top">
                    <h3>${mesa.nombreMesa}</h3>
                    <span class="badge badge-sistema">${mesa.sistema}</span>
                </div>
                <p class="mesa-card__desc">${mesa.descripcion}</p>
                <div class="mesa-card__meta">
                    <span><strong>${LPR.UI.formatFecha(mesa.fecha)}</strong>${mesa.hora ? ` · ${mesa.hora}hs` : ""}</span>
                    <span>Experiencia: <strong>${mesa.experiencia}</strong></span>
                </div>
                <div class="mesa-card__meta">
                    <span class="badge ${badgeClase}">${llena ? "Sin cupos" : `${disponibles} de ${mesa.cupos} cupos`}</span>
                </div>
            </a>`;
    }

    function mostrar() {
        let mesas = todasLasMesas;

        const texto = fTexto.value.trim().toLowerCase();
        if (texto) {
            mesas = mesas.filter((m) =>
                [m.nombreMesa, m.sistema, ...(m.keywords || [])].join(" ").toLowerCase().includes(texto)
            );
        }
        if (fSistema.value) mesas = mesas.filter((m) => m.sistema === fSistema.value);
        if (fExperiencia.value) mesas = mesas.filter((m) => m.experiencia === fExperiencia.value);
        if (fDisponibilidad.value === "disponible") mesas = mesas.filter((m) => !LPR.Mesas.estaLlena(m));
        if (fDisponibilidad.value === "llena") mesas = mesas.filter((m) => LPR.Mesas.estaLlena(m));

        contenedor.innerHTML = mesas.length
            ? mesas.map(tarjeta).join("")
            : '<p class="empty-state">No hay mesas que coincidan con esos filtros.</p>';
    }

    poblarSistemas(todasLasMesas);
    [fTexto, fSistema, fExperiencia, fDisponibilidad].forEach((el) => el.addEventListener("input", mostrar));
    mostrar();
});
