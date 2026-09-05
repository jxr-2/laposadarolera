document.addEventListener("DOMContentLoaded", async () => {
    await LPR.Auth.init();
    if (!LPR.Auth.requireLogin("login.html")) return;
    await LPR.Mesas.archivarVencidasAutomaticamente();

    const contenedor = document.getElementById("contenedorArchivo");
    const fTexto = document.getElementById("f-texto");
    const mesas = await LPR.Mesas.archivadas();

    const sistemas = new Set(mesas.map((m) => m.sistema));
    document.getElementById("archivo-stats").innerHTML = `
        <div class="stat-tile"><div class="stat-tile__value">${mesas.length}</div><div class="stat-tile__label">Mesas jugadas</div></div>
        <div class="stat-tile"><div class="stat-tile__value">${sistemas.size}</div><div class="stat-tile__label">Sistemas distintos</div></div>
    `;

    function tarjeta(mesa) {
        return `
            <a class="mesa-card" href="mesa_detalle.html?id=${mesa.id}">
                <div class="mesa-card__top">
                    <h3>${mesa.nombreMesa}</h3>
                    <span class="badge badge-sistema">${mesa.sistema}</span>
                </div>
                <p class="mesa-card__desc">${mesa.descripcion}</p>
                <div class="mesa-card__meta"><span>${LPR.UI.formatFecha(mesa.fecha)}</span></div>
            </a>`;
    }

    function mostrar() {
        const texto = fTexto.value.trim().toLowerCase();
        const filtradas = texto
            ? mesas.filter((m) => [m.nombreMesa, m.sistema, ...(m.keywords || [])].join(" ").toLowerCase().includes(texto))
            : mesas;
        contenedor.innerHTML = filtradas.length
            ? filtradas.map(tarjeta).join("")
            : '<p class="empty-state">Todavía no hay mesas archivadas.</p>';
    }

    fTexto.addEventListener("input", mostrar);
    mostrar();
});
