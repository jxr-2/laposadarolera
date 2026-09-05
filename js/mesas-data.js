// LPR.Mesas: reglas de negocio de mesas e inscripciones, contra Supabase.
//
// Nota de diseño: cuposOcupados/cuposDisponibles/estaLlena siguen siendo
// funciones SÍNCRONAS (no piden red) porque listar()/obtener()/archivadas()/
// mesasCreadasPor() ya traen el conteo de inscriptos pegado a cada mesa
// (mesa._ocupados) en el mismo viaje a la base. Si tenés un objeto "mesa" que
// no vino de esas funciones, esos cálculos van a estar mal.
window.LPR = window.LPR || {};

(function () {
    function normalizarMesa(row) {
        return {
            id: row.id,
            nombreMesa: row.nombre_mesa,
            sistema: row.sistema,
            duracion: row.duracion,
            experiencia: row.experiencia,
            descripcion: row.descripcion,
            enfoque: row.enfoque,
            keywords: row.keywords || [],
            cupos: row.cupos,
            fecha: row.fecha,
            hora: row.hora ? String(row.hora).slice(0, 5) : "",
            lugar: row.lugar,
            estado: row.estado,
            creadorId: row.creador_id,
            origen: { nombreNarrador: row.narrador_nombre || "", contactoNarrador: row.narrador_contacto || "" },
            creadaEn: row.creada_en,
            _ocupados: 0,
        };
    }

    function aFila(datos) {
        const fila = {};
        if (datos.nombreMesa !== undefined) fila.nombre_mesa = datos.nombreMesa;
        if (datos.sistema !== undefined) fila.sistema = datos.sistema;
        if (datos.duracion !== undefined) fila.duracion = datos.duracion;
        if (datos.experiencia !== undefined) fila.experiencia = datos.experiencia;
        if (datos.descripcion !== undefined) fila.descripcion = datos.descripcion;
        if (datos.enfoque !== undefined) fila.enfoque = datos.enfoque;
        if (datos.keywords !== undefined) fila.keywords = datos.keywords;
        if (datos.cupos !== undefined) fila.cupos = datos.cupos;
        if (datos.fecha !== undefined) fila.fecha = datos.fecha;
        if (datos.hora !== undefined) fila.hora = datos.hora || null;
        if (datos.lugar !== undefined) fila.lugar = datos.lugar;
        if (datos.estado !== undefined) fila.estado = datos.estado;
        if (datos.creadorId !== undefined) fila.creador_id = datos.creadorId;
        if (datos.origen !== undefined) {
            fila.narrador_nombre = datos.origen.nombreNarrador || null;
            fila.narrador_contacto = datos.origen.contactoNarrador || null;
        }
        return fila;
    }

    // Trae, para un lote de mesas, cuántos inscriptos activos tiene cada una,
    // y lo pega en mesa._ocupados. Un solo viaje a la base para todo el lote.
    async function adjuntarCupos(mesas) {
        if (mesas.length === 0) return mesas;
        const ids = mesas.map((m) => m.id);
        const { data, error } = await LPR.sb.from("inscripciones").select("mesa_id").in("mesa_id", ids).neq("estado", "cancelada");
        if (!error && data) {
            const conteos = {};
            data.forEach((r) => { conteos[r.mesa_id] = (conteos[r.mesa_id] || 0) + 1; });
            mesas.forEach((m) => { m._ocupados = conteos[m.id] || 0; });
        }
        return mesas;
    }

    async function listar({ soloPublicadas = true } = {}) {
        let q = LPR.sb.from("mesas").select("*").order("fecha", { ascending: true });
        if (soloPublicadas) q = q.eq("estado", "publicada");
        const { data, error } = await q;
        if (error) { console.error(error); return []; }
        return adjuntarCupos(data.map(normalizarMesa));
    }

    async function archivadas() {
        const { data, error } = await LPR.sb.from("mesas").select("*").eq("estado", "archivada").order("fecha", { ascending: false });
        if (error) { console.error(error); return []; }
        return adjuntarCupos(data.map(normalizarMesa));
    }

    async function obtener(id) {
        const { data, error } = await LPR.sb.from("mesas").select("*").eq("id", id).maybeSingle();
        if (error || !data) return null;
        const [mesa] = await adjuntarCupos([normalizarMesa(data)]);
        return mesa;
    }

    async function mesasCreadasPor(userId) {
        const { data, error } = await LPR.sb.from("mesas").select("*").eq("creador_id", userId).order("fecha", { ascending: false });
        if (error) return [];
        return adjuntarCupos(data.map(normalizarMesa));
    }

    async function crear(datos, adminId) {
        const fila = aFila(datos);
        fila.estado = "publicada";
        fila.creador_id = adminId;
        const { data, error } = await LPR.sb.from("mesas").insert(fila).select().single();
        if (error) { console.error(error); return null; }
        return normalizarMesa(data);
    }

    async function actualizar(id, patch) {
        const { data, error } = await LPR.sb.from("mesas").update(aFila(patch)).eq("id", id).select().single();
        if (error) { console.error(error); return null; }
        return normalizarMesa(data);
    }

    async function archivar(id) { return actualizar(id, { estado: "archivada" }); }
    async function republicar(id) { return actualizar(id, { estado: "publicada" }); }

    async function eliminar(id) {
        await LPR.sb.from("mesas").delete().eq("id", id);
    }

    async function archivarVencidasAutomaticamente() {
        const hoy = new Date().toISOString().slice(0, 10);
        await LPR.sb.from("mesas").update({ estado: "archivada" }).eq("estado", "publicada").lt("fecha", hoy);
    }

    function cuposOcupados(mesa) {
        return mesa._ocupados || 0;
    }

    function cuposDisponibles(mesa) {
        return Math.max(0, mesa.cupos - cuposOcupados(mesa));
    }

    function estaLlena(mesa) {
        return cuposDisponibles(mesa) <= 0;
    }

    function normalizarInscripcion(row) {
        return {
            id: row.id,
            mesaId: row.mesa_id,
            tipo: row.tipo,
            userId: row.usuario_id,
            nombre: row.nombre,
            contacto: row.contacto,
            estado: row.estado,
            creadaEn: row.creada_en,
        };
    }

    async function inscripcionesDeMesa(mesaId) {
        const { data, error } = await LPR.sb.from("inscripciones").select("*").eq("mesa_id", mesaId).neq("estado", "cancelada");
        if (error) return [];
        return data.map(normalizarInscripcion);
    }

    async function todasInscripciones() {
        const { data, error } = await LPR.sb
            .from("inscripciones")
            .select("*, mesas(nombre_mesa)")
            .neq("estado", "cancelada")
            .order("creada_en", { ascending: false });
        if (error) { console.error(error); return []; }
        return data.map((row) => ({ ...normalizarInscripcion(row), mesaNombre: row.mesas ? row.mesas.nombre_mesa : "(mesa eliminada)" }));
    }

    async function yaInscripto(mesaId, userId) {
        const { data, error } = await LPR.sb
            .from("inscripciones")
            .select("id")
            .eq("mesa_id", mesaId)
            .eq("usuario_id", userId)
            .neq("estado", "cancelada")
            .maybeSingle();
        return !error && !!data;
    }

    async function inscribirConCuenta(mesaId, user) {
        const mesa = await obtener(mesaId);
        if (!mesa) return { ok: false, error: "La mesa no existe." };
        if (await yaInscripto(mesaId, user.id)) return { ok: false, error: "Ya estás inscripto en esta mesa." };
        if (estaLlena(mesa)) return { ok: false, error: "Esta mesa ya no tiene cupos disponibles." };
        const { error } = await LPR.sb.from("inscripciones").insert({
            mesa_id: mesaId,
            tipo: "cuenta",
            usuario_id: user.id,
            nombre: user.nombre,
            contacto: user.telefono || user.email,
            estado: "confirmada",
        });
        if (error) return { ok: false, error: "No se pudo completar la inscripción." };
        return { ok: true };
    }

    async function inscribirComoInvitado(mesaId, { nombre, contacto }) {
        const mesa = await obtener(mesaId);
        if (!mesa) return { ok: false, error: "La mesa no existe." };
        if (!nombre || !contacto) return { ok: false, error: "Nombre y contacto son obligatorios." };
        if (estaLlena(mesa)) return { ok: false, error: "Esta mesa ya no tiene cupos disponibles." };
        const { error } = await LPR.sb.from("inscripciones").insert({
            mesa_id: mesaId,
            tipo: "invitado",
            usuario_id: null,
            nombre: nombre.trim(),
            contacto: contacto.trim(),
            estado: "pendiente",
        });
        if (error) return { ok: false, error: "No se pudo completar la inscripción." };
        return { ok: true };
    }

    async function cancelarInscripcion(id) {
        const { error } = await LPR.sb.from("inscripciones").update({ estado: "cancelada" }).eq("id", id);
        return { ok: !error };
    }

    async function confirmarInscripcion(id) {
        const { error } = await LPR.sb.from("inscripciones").update({ estado: "confirmada" }).eq("id", id);
        return { ok: !error };
    }

    async function inscripcionesDeUsuario(userId) {
        const { data, error } = await LPR.sb.from("inscripciones").select("*").eq("usuario_id", userId).neq("estado", "cancelada");
        if (error) return [];
        return data.map(normalizarInscripcion);
    }

    function generarTextoInstagram(mesa) {
        const disponibles = cuposDisponibles(mesa);
        const kw = (mesa.keywords || []).map((k) => `#${String(k).replace(/\s+/g, "")}`).join(" ");
        return [
            `🎲 ${mesa.nombreMesa}`,
            `Sistema: ${mesa.sistema}`,
            `Fecha: ${mesa.fecha}${mesa.hora ? ` · ${mesa.hora}hs` : ""}`,
            `Cupos disponibles: ${disponibles}/${mesa.cupos}`,
            "",
            mesa.descripcion || "",
            "",
            "¡Inscribite en La Posada Rolera!",
            kw,
        ].join("\n");
    }

    async function obtenerConfig() {
        const { data, error } = await LPR.sb.from("config").select("*").eq("id", 1).maybeSingle();
        if (error || !data) return { temporada: "", maxMesasActivas: 5, nombrePosada: "La Posada Rolera", ciudad: "Puerto Madryn" };
        return {
            temporada: data.temporada || "",
            maxMesasActivas: data.max_mesas_activas,
            nombrePosada: data.nombre_posada,
            ciudad: data.ciudad,
        };
    }

    async function guardarConfig(patch) {
        const fila = {};
        if (patch.temporada !== undefined) fila.temporada = patch.temporada;
        if (patch.maxMesasActivas !== undefined) fila.max_mesas_activas = patch.maxMesasActivas;
        const { error } = await LPR.sb.from("config").update(fila).eq("id", 1);
        return { ok: !error };
    }

    LPR.Mesas = {
        listar,
        archivadas,
        obtener,
        mesasCreadasPor,
        crear,
        actualizar,
        archivar,
        republicar,
        eliminar,
        archivarVencidasAutomaticamente,
        cuposOcupados,
        cuposDisponibles,
        estaLlena,
        inscripcionesDeMesa,
        todasInscripciones,
        yaInscripto,
        inscribirConCuenta,
        inscribirComoInvitado,
        cancelarInscripcion,
        confirmarInscripcion,
        inscripcionesDeUsuario,
        generarTextoInstagram,
        obtenerConfig,
        guardarConfig,
    };
})();
