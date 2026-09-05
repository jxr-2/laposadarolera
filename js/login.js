document.addEventListener("DOMContentLoaded", async () => {
    await LPR.Auth.init();
    if (LPR.Auth.currentUser()) {
        location.href = destinoRetorno();
        return;
    }

    const tabIngresar = document.getElementById("tab-ingresar");
    const tabCrear = document.getElementById("tab-crear");
    const panelIngresar = document.getElementById("panel-ingresar");
    const panelCrear = document.getElementById("panel-crear");

    tabIngresar.addEventListener("click", () => activarTab("ingresar"));
    tabCrear.addEventListener("click", () => activarTab("crear"));

    function activarTab(nombre) {
        const esIngresar = nombre === "ingresar";
        tabIngresar.classList.toggle("is-active", esIngresar);
        tabCrear.classList.toggle("is-active", !esIngresar);
        panelIngresar.hidden = !esIngresar;
        panelCrear.hidden = esIngresar;
    }

    function destinoRetorno() {
        const ret = LPR.UI.qs("return");
        return ret ? ret : "mesas_subidas.html";
    }

    document.getElementById("form-ingresar").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("li-email").value;
        const pass = document.getElementById("li-pass").value;
        const res = await LPR.Auth.login(email, pass);
        const errorEl = document.getElementById("error-ingresar");
        if (!res.ok) {
            errorEl.textContent = res.error;
            errorEl.hidden = false;
            return;
        }
        LPR.UI.toast(`¡Bienvenido/a, ${res.user.apodo || res.user.nombre}!`, "success");
        setTimeout(() => (location.href = destinoRetorno()), 350);
    });

    document.getElementById("form-crear").addEventListener("submit", async (e) => {
        e.preventDefault();
        const datos = {
            nombre: document.getElementById("cr-nombre").value,
            apodo: document.getElementById("cr-apodo").value,
            email: document.getElementById("cr-email").value,
            telefono: document.getElementById("cr-telefono").value,
            password: document.getElementById("cr-pass").value,
        };
        const res = await LPR.Auth.registrar(datos);
        const errorEl = document.getElementById("error-crear");
        if (!res.ok) {
            errorEl.textContent = res.error;
            errorEl.hidden = false;
            return;
        }
        LPR.UI.toast("Cuenta creada. ¡Bienvenido/a a la posada!", "success");
        setTimeout(() => (location.href = destinoRetorno()), 350);
    });
});
