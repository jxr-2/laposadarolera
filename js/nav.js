// LPR.Nav: arma la zona de sesión del topbar y oculta enlaces que
// requieren cuenta para usuarios sin sesión iniciada.
window.LPR = window.LPR || {};

(function () {
    function base() {
        return location.pathname.includes("/html/") ? "" : "html/";
    }

    function render() {
        const host = document.getElementById("nav-auth");
        if (!host) return;
        const user = LPR.Auth.currentUser();
        const b = base();

        document.querySelectorAll("[data-require-auth]").forEach((el) => {
            el.style.display = user ? "" : "none";
        });
        document.querySelectorAll("[data-require-admin]").forEach((el) => {
            el.style.display = user && user.rol === "admin" ? "" : "none";
        });

        if (!user) {
            host.innerHTML = `<a class="nav-button" href="${b}login.html">Ingresar</a>`;
            return;
        }

        host.innerHTML = `
            <a class="nav-account" href="${b}perfil.html">
                <span>${(user.apodo || user.nombre).split(" ")[0]}</span>
                <span class="nav-avatar">${LPR.UI.iniciales(user.apodo || user.nombre)}</span>
            </a>
        `;
    }

    document.addEventListener("DOMContentLoaded", async () => {
        await LPR.Auth.init();
        render();
    });
    LPR.Nav = { render };
})();
