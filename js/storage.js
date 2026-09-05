// LPR.Storage: conexión a Supabase. Antes esto guardaba todo en localStorage;
// ahora los datos viven en la base de datos real (ver sql/supabase_schema.sql).
//
// Completá estas dos líneas con los datos de TU proyecto:
// supabase.com > tu proyecto > Settings > API > "Project URL" y "anon public" key.
window.LPR = window.LPR || {};

(function () {
    const SUPABASE_URL = "https://rflgmdswraftvjkfucof.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_WMpdyoKSamCTnQpKr9qXmw_kOn5Zf9Y";

    function avisoDeConfiguracion(detalle) {
        document.addEventListener("DOMContentLoaded", () => {
            const aviso = document.createElement("div");
            aviso.style.cssText =
                "position:fixed;inset:0;z-index:9999;background:#101010;color:#f2eee8;display:flex;" +
                "align-items:center;justify-content:center;padding:40px;font-family:sans-serif;text-align:center;";
            aviso.innerHTML = `
                <div style="max-width:520px;">
                    <h2 style="margin-bottom:16px;">Falta configurar Supabase</h2>
                    <p style="line-height:1.6;">Abrí <code>js/storage.js</code> y completá <code>SUPABASE_URL</code> y
                    <code>SUPABASE_ANON_KEY</code> con los datos de tu proyecto
                    (supabase.com → tu proyecto → Settings → API), después recargá la página.</p>
                    <p style="color:#b7b2ad; font-size:13px; margin-top:14px;">${detalle}</p>
                </div>`;
            document.body.appendChild(aviso);
        });
    }

    // hash NO criptográfico: alcanza para un prototipo entre gente de confianza,
    // no para producción real. Si esto se abre al público conviene pasar a
    // Supabase Auth de verdad.
    function hashPassword(pass) {
        let hash = 0;
        const str = `lpr::${pass}`;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return `h${hash}`;
    }

    let sb = null;
    if (!window.supabase) {
        avisoDeConfiguracion("No cargó supabase-js — revisá que ese <script> esté antes de js/storage.js en el HTML.");
    } else if (SUPABASE_URL.startsWith("PONE_ACA") || SUPABASE_ANON_KEY.startsWith("PONE_ACA")) {
        avisoDeConfiguracion("Todavía tenés los valores de ejemplo sin completar.");
    } else {
        try {
            sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch (e) {
            console.error(e);
            avisoDeConfiguracion(`Error: ${e.message}`);
        }
    }

    LPR.sb = sb;
    LPR.Storage = { hashPassword };
})();
