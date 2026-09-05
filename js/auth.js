// LPR.Auth: registro, login, sesión y guardas de acceso por rol.
// La sesión (qué usuario está logueado en ESTE navegador) sigue viviendo en
// localStorage — eso es correcto y esperado: cada dispositivo se loguea por
// su cuenta, lo que cambió es que ahora todos comparten los mismos datos.
window.LPR = window.LPR || {};

(function () {
    let _currentUser = null;
    let _initPromise = null;

    function leerSesion() {
        try {
            const raw = localStorage.getItem("lpr_session");
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function guardarSesion(userId) {
        localStorage.setItem("lpr_session", JSON.stringify({ userId }));
    }

    function borrarSesion() {
        localStorage.removeItem("lpr_session");
    }

    // Se llama una vez por página (nav.js y cada script de página la esperan).
    // Memoizada: si varios scripts la llaman a la vez, comparten el mismo pedido.
    function init() {
        if (_initPromise) return _initPromise;
        _initPromise = (async () => {
            const session = leerSesion();
            if (!session) {
                _currentUser = null;
                return null;
            }
            const { data, error } = await LPR.sb.rpc("rpc_obtener_usuario", { p_id: session.userId });
            _currentUser = !error && data && data.length ? data[0] : null;
            if (!_currentUser) borrarSesion();
            return _currentUser;
        })();
        return _initPromise;
    }

    function currentUser() {
        return _currentUser;
    }

    async function registrar({ nombre, apodo, email, telefono, password }) {
        if (!nombre || !email || !password) {
            return { ok: false, error: "Completá nombre, email y contraseña." };
        }
        const { data, error } = await LPR.sb.rpc("rpc_registrar_usuario", {
            p_nombre: nombre.trim(),
            p_apodo: (apodo || "").trim(),
            p_email: email.trim().toLowerCase(),
            p_telefono: (telefono || "").trim(),
            p_hash: LPR.Storage.hashPassword(password),
        });
        if (error) {
            const msg = /email_en_uso/.test(error.message) ? "Ya existe una cuenta con ese email." : "No se pudo crear la cuenta.";
            return { ok: false, error: msg };
        }
        const user = data[0];
        _currentUser = user;
        _initPromise = Promise.resolve(user);
        guardarSesion(user.id);
        return { ok: true, user };
    }

    async function login(email, password) {
        const { data, error } = await LPR.sb.rpc("rpc_login_usuario", {
            p_email: (email || "").trim().toLowerCase(),
            p_hash: LPR.Storage.hashPassword(password),
        });
        if (error || !data || data.length === 0) {
            return { ok: false, error: "Email o contraseña incorrectos." };
        }
        const user = data[0];
        _currentUser = user;
        _initPromise = Promise.resolve(user);
        guardarSesion(user.id);
        return { ok: true, user };
    }

    function logout() {
        borrarSesion();
        _currentUser = null;
    }

    async function updateCurrentUser(patch) {
        const user = currentUser();
        if (!user) return { ok: false, error: "No hay sesión activa." };
        const { data, error } = await LPR.sb.rpc("rpc_actualizar_perfil", {
            p_id: user.id,
            p_nombre: patch.nombre,
            p_apodo: patch.apodo,
            p_email: patch.email,
            p_telefono: patch.telefono,
            p_bio: patch.bio,
            p_narrador: patch.narrador,
        });
        if (error) {
            const msg = /email_en_uso/.test(error.message) ? "Ese email ya está en uso." : "No se pudo actualizar.";
            return { ok: false, error: msg };
        }
        _currentUser = data[0];
        return { ok: true, user: _currentUser };
    }

    async function cambiarPassword(actual, nueva) {
        const user = currentUser();
        if (!user) return { ok: false, error: "No hay sesión activa." };
        const { data, error } = await LPR.sb.rpc("rpc_cambiar_password", {
            p_id: user.id,
            p_hash_actual: LPR.Storage.hashPassword(actual),
            p_hash_nuevo: LPR.Storage.hashPassword(nueva),
        });
        if (error || data !== true) return { ok: false, error: "La contraseña actual no coincide." };
        return { ok: true };
    }

    async function listarUsuarios() {
        const { data, error } = await LPR.sb.rpc("rpc_listar_usuarios");
        return error ? [] : data;
    }

    async function cambiarRol(userId, rol) {
        const { error } = await LPR.sb.rpc("rpc_cambiar_rol", { p_id: userId, p_rol: rol });
        return { ok: !error };
    }

    async function eliminarUsuario(userId) {
        const { error } = await LPR.sb.rpc("rpc_eliminar_usuario", { p_id: userId });
        return { ok: !error };
    }

    // Redirige si no cumple el requisito. Llamar DESPUÉS de `await LPR.Auth.init()`.
    function requireLogin(redirectTo) {
        const user = currentUser();
        if (!user) {
            const ret = encodeURIComponent(location.pathname.split("/").pop() + location.search);
            location.href = `${redirectTo || "login.html"}?return=${ret}`;
            return null;
        }
        return user;
    }

    function requireAdmin(redirectTo) {
        const user = requireLogin(redirectTo);
        if (!user) return null;
        if (user.rol !== "admin") {
            location.href = location.pathname.includes("/html/") ? "../index.html" : "index.html";
            return null;
        }
        return user;
    }

    LPR.Auth = {
        init,
        registrar,
        login,
        logout,
        currentUser,
        updateCurrentUser,
        cambiarPassword,
        listarUsuarios,
        cambiarRol,
        eliminarUsuario,
        requireLogin,
        requireAdmin,
    };
})();
