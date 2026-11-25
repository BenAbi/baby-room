// Almacén de proyectos de Planos: un archivo JSON por proyecto en <datos>/proyectos/ y un directorio de
// usuarios vistos en <datos>/usuarios.json. Todo local; la carpeta de datos nunca va al repositorio.
//
// Proyecto: { id, nombre, dueno (sub de BAS), compartidos: [{ usuario, sub|null, permiso }], version, creado, actualizado, datos }
//   permiso: "editar" o "ver". Se comparte por nombre de usuario de BAS; la primera vez que esa persona entra
//   en Planos se ata a su id (sub), así otra cuenta que más adelante tenga el mismo nombre no hereda el acceso.
import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export const PERMISOS = ["editar", "ver"];
export const MAX_DATOS = 5 * 1024 * 1024;
const MAX_PROYECTOS = 200, MAX_COMPARTIDOS = 50;
const ID_VALIDO = /^[A-Za-z0-9_-]{12}$/;
const USUARIO_VALIDO = /^[a-z0-9._-]{3,32}$/i;

export class ErrorPlanos extends Error {
  constructor(estado, mensaje, extra) { super(mensaje); this.estado = estado; this.extra = extra; }
}

const ahora = () => new Date().toISOString();
const min = (s) => String(s ?? "").toLowerCase();
const sid = (u) => String(u.sub); // el id de BAS, siempre como texto (también es la clave en usuarios.json)

function escribir(ruta, valor) {
  const tmp = `${ruta}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(valor));
  renameSync(tmp, ruta);
}

function nombreValido(nombre) {
  const n = typeof nombre === "string" ? nombre.trim().replace(/\s+/g, " ") : "";
  if (!n || n.length > 80) throw new ErrorPlanos(400, "El nombre del proyecto debe tener entre 1 y 80 caracteres.");
  return n;
}

function datosValidos(datos) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos) || !Array.isArray(datos.rooms) || !datos.rooms.length)
    throw new ErrorPlanos(400, "Los datos del plano no son válidos.");
  if (JSON.stringify(datos).length > MAX_DATOS) throw new ErrorPlanos(413, "El plano es demasiado grande.");
  return datos;
}

export function crearAlmacen(dir) {
  const dirProyectos = join(dir, "proyectos");
  mkdirSync(dirProyectos, { recursive: true });
  const rutaUsuarios = join(dir, "usuarios.json");
  const usuarios = existsSync(rutaUsuarios) ? JSON.parse(readFileSync(rutaUsuarios, "utf8")) : {};
  const proyectos = new Map();
  for (const f of readdirSync(dirProyectos)) {
    if (!f.endsWith(".json")) continue;
    const p = JSON.parse(readFileSync(join(dirProyectos, f), "utf8"));
    proyectos.set(p.id, p);
  }
  const guardarProyecto = (p) => escribir(join(dirProyectos, `${p.id}.json`), p);

  function permiso(p, u) {
    if (p.dueno === sid(u)) return "dueno";
    const c = p.compartidos.find((c) => (c.sub ? c.sub === sid(u) : c.usuario === min(u.usuario)));
    return c ? c.permiso : null;
  }
  function buscar(u, id, necesario = "ver") {
    const p = ID_VALIDO.test(String(id)) ? proyectos.get(id) : null;
    const rol = p && permiso(p, u);
    if (!rol) throw new ErrorPlanos(404, "Ese proyecto no existe o no lo tienes compartido.");
    if (necesario === "editar" && rol === "ver") throw new ErrorPlanos(403, "Solo puedes ver este proyecto.");
    if (necesario === "dueno" && rol !== "dueno") throw new ErrorPlanos(403, "Solo quien creó el proyecto puede hacer esto.");
    return { p, rol };
  }
  const persona = (sub) => usuarios[sub] ? { usuario: usuarios[sub].usuario, nombre: usuarios[sub].nombre } : { usuario: "?", nombre: "Usuario de BAS" };
  function resumen(p, rol) {
    const r = { id: p.id, nombre: p.nombre, permiso: rol, dueno: persona(p.dueno), version: p.version, actualizado: p.actualizado };
    if (p.editadoPor) r.editadoPor = persona(p.editadoPor);
    if (rol === "dueno") r.compartidos = p.compartidos.map((c) => ({
      usuario: c.sub && usuarios[c.sub] ? usuarios[c.sub].usuario : c.usuario,
      nombre: c.sub && usuarios[c.sub] ? usuarios[c.sub].nombre : null,
      permiso: c.permiso,
    }));
    return r;
  }

  return {
    /** Anota quién es (nombre y usuario de BAS) y ata a su id los proyectos que le compartieron antes de entrar. */
    conocer(u) {
      const previo = usuarios[sid(u)];
      if (!previo || previo.usuario !== u.usuario || previo.nombre !== u.nombre) {
        usuarios[sid(u)] = { usuario: u.usuario, nombre: u.nombre, visto: ahora() };
        escribir(rutaUsuarios, usuarios);
      }
      for (const p of proyectos.values()) {
        const c = p.compartidos.find((c) => !c.sub && c.usuario === min(u.usuario));
        if (c && p.dueno !== sid(u)) { c.sub = sid(u); guardarProyecto(p); }
      }
    },
    lista(u) {
      const res = [];
      for (const p of proyectos.values()) { const rol = permiso(p, u); if (rol) res.push(resumen(p, rol)); }
      return res.sort((a, b) => b.actualizado.localeCompare(a.actualizado));
    },
    crear(u, { nombre, datos }) {
      const propios = [...proyectos.values()].filter((p) => p.dueno === sid(u)).length;
      if (propios >= MAX_PROYECTOS) throw new ErrorPlanos(400, `Has llegado al máximo de ${MAX_PROYECTOS} proyectos.`);
      let id; do { id = randomBytes(9).toString("base64url"); } while (proyectos.has(id));
      const t = ahora();
      const p = { id, nombre: nombreValido(nombre), dueno: sid(u), compartidos: [], version: 1, creado: t, actualizado: t, editadoPor: sid(u), datos: datosValidos(datos) };
      proyectos.set(id, p); guardarProyecto(p);
      return { ...resumen(p, "dueno"), datos: p.datos };
    },
    obtener(u, id) {
      const { p, rol } = buscar(u, id);
      return { ...resumen(p, rol), datos: p.datos };
    },
    version(u, id) {
      const { p, rol } = buscar(u, id);
      return { version: p.version, permiso: rol, actualizado: p.actualizado, editadoPor: p.editadoPor ? persona(p.editadoPor) : null };
    },
    /** Guarda el plano si `version` es la última; si otra persona guardó antes, 409 con la versión actual. */
    guardar(u, id, { version, datos }) {
      const { p } = buscar(u, id, "editar");
      if (version !== p.version) throw new ErrorPlanos(409, "Otra persona ha cambiado este plano mientras tanto.", { version: p.version, editadoPor: p.editadoPor ? persona(p.editadoPor) : null });
      p.datos = datosValidos(datos);
      p.version++; p.actualizado = ahora(); p.editadoPor = sid(u);
      guardarProyecto(p);
      return { version: p.version, actualizado: p.actualizado };
    },
    renombrar(u, id, nombre) {
      const { p } = buscar(u, id, "dueno");
      p.nombre = nombreValido(nombre); p.actualizado = ahora();
      guardarProyecto(p);
      return resumen(p, "dueno");
    },
    /** El dueño lo borra; quien lo tiene compartido solo deja de verlo. */
    borrar(u, id) {
      const { p, rol } = buscar(u, id);
      if (rol === "dueno") {
        proyectos.delete(p.id);
        rmSync(join(dirProyectos, `${p.id}.json`), { force: true });
        return { borrado: true };
      }
      p.compartidos = p.compartidos.filter((c) => !(c.sub ? c.sub === sid(u) : c.usuario === min(u.usuario)));
      guardarProyecto(p);
      return { dejado: true };
    },
    compartir(u, id, { usuario, permiso: nivel }) {
      const { p } = buscar(u, id, "dueno");
      const nombre = min(typeof usuario === "string" ? usuario.trim().replace(/^@/, "") : "");
      if (!USUARIO_VALIDO.test(nombre)) throw new ErrorPlanos(400, "Escribe el nombre de usuario de BAS de esa persona.");
      if (!PERMISOS.includes(nivel)) throw new ErrorPlanos(400, "Elige «puede editar» o «solo ver».");
      if (min(usuarios[sid(u)]?.usuario ?? u.usuario) === nombre) throw new ErrorPlanos(400, "Este proyecto ya es tuyo.");
      const subConocido = Object.entries(usuarios).find(([, d]) => min(d.usuario) === nombre)?.[0] ?? null;
      let c = p.compartidos.find((c) => (subConocido && c.sub === subConocido) || (!c.sub && c.usuario === nombre));
      if (c) c.permiso = nivel;
      else {
        if (p.compartidos.length >= MAX_COMPARTIDOS) throw new ErrorPlanos(400, `Un proyecto se puede compartir con ${MAX_COMPARTIDOS} personas como mucho.`);
        c = { usuario: nombre, sub: subConocido, permiso: nivel };
        p.compartidos.push(c);
      }
      guardarProyecto(p);
      return { ...resumen(p, "dueno"), haEntrado: Boolean(subConocido) };
    },
    quitar(u, id, usuario) {
      const { p } = buscar(u, id, "dueno");
      const nombre = min(usuario);
      const antes = p.compartidos.length;
      p.compartidos = p.compartidos.filter((c) => min(c.sub && usuarios[c.sub] ? usuarios[c.sub].usuario : c.usuario) !== nombre);
      if (p.compartidos.length === antes) throw new ErrorPlanos(404, "Ese usuario no tenía este proyecto compartido.");
      guardarProyecto(p);
      return resumen(p, "dueno");
    },
  };
}
