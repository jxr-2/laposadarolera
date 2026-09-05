# La Posada Rolera — prototipo

Sitio para centralizar la organización de los domingos de rol: publicar mesas, que la gente se inscriba, y que los administradores manejen cupos, inscriptos y el archivo histórico.

## Cómo abrirlo

1. Creá un proyecto en [supabase.com](https://supabase.com) (gratis).
2. Andá a **SQL Editor** → pegá todo el contenido de [sql/supabase_schema.sql](sql/supabase_schema.sql) → **Run**. Eso crea las tablas, los permisos y las cuentas demo.
3. Andá a **Settings → API** y copiá el **Project URL** y la key **anon public**.
4. Abrí [js/storage.js](js/storage.js) y pegalas en `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
5. Abrí `index.html` en el navegador (o levantá un servidor local si preferís: `python -m http.server 8420` y entrá a `http://localhost:8420`).

Si te olvidaste el paso 4, la página te avisa en pantalla en vez de romperse en silencio.

## Cuentas de prueba

- **Admin:** `admin@posadarolera.com` / `admin123`
- **Usuaria registrada:** `demo@posadarolera.com` / `demo123`

(Estas cuentas las crea el script SQL del paso 2. Se pueden crear cuentas nuevas desde "Crear cuenta" en el login.)

## Qué es y qué no es este prototipo

Los datos (cuentas, mesas, inscripciones, configuración) ya viven en una base de datos real en Supabase, compartida por todos los que entren al sitio — dos personas en dos navegadores/dispositivos distintos ven lo mismo. Lo único que sigue siendo por-navegador es la sesión (tenés que loguearte en cada dispositivo, como en cualquier sitio).

Importante sobre seguridad: el login sigue siendo el hash casero de antes (no Supabase Auth), así que Postgres no puede distinguir "quién" hace cada pedido. Eso significa:

- La tabla `usuarios` está completamente cerrada a la key pública — solo se accede a través de funciones (`rpc_login_usuario`, `rpc_registrar_usuario`, etc.) que nunca exponen la contraseña.
- Las tablas `mesas`, `inscripciones` y `config` están abiertas a la key pública (anon): cualquiera que mire el código fuente y tenga esa key podría leerlas o escribirlas directo, sin pasar por la interfaz. Los admins solo se distinguen en el JS de la app, no a nivel de base de datos.

Está bien para probar con el grupo de la posada, pero **no es seguridad real de producción**. El día que esto se abra al público en serio, conviene migrar a Supabase Auth + políticas RLS por usuario.

## Reglas de acceso implementadas

- **Sin cuenta:** solo puede ver la home y, si tiene el link directo a una mesa puntual, inscribirse a esa mesa como invitado (nombre + contacto), quedando pendiente hasta que un admin la confirme.
- **Cuenta registrada:** ve el listado completo de mesas, el archivo histórico, se inscribe con un clic y gestiona su perfil.
- **Admin:** todo lo anterior + cargar/editar/archivar/eliminar mesas, confirmar inscripciones, gestionar usuarios (promover/degradar/eliminar), configurar la temporada (cantidad objetivo de mesas activas) y generar el texto para Instagram de cada mesa.

## Estructura

```
index.html            Home pública
html/                 Resto de las páginas (login, mesas, detalle, perfil, admin, archivo, cargar mesa)
css/index.css         Estilos del home + topbar/nav compartido
css/app.css           Componentes compartidos (cards, formularios, tablas, tabs, toasts, etc.)
js/storage.js         Conexión a Supabase (poné acá tu URL/key) + helper de hash
js/auth.js            Registro, login, sesión, guardas por rol (vía funciones RPC)
js/mesas-data.js       Reglas de negocio de mesas e inscripciones (contra Supabase)
js/ui.js, nav.js       Helpers de interfaz compartidos
sql/supabase_schema.sql   Esquema real: tablas, RLS y funciones — correr en Supabase
```
