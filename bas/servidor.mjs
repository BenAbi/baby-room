// Planos: el planificador de casa como app de BAS. Sin dependencias de servidor: solo Node 24.
// - Escucha solo en 127.0.0.1: desde fuera se entra siempre por BAS, que hace el inicio de sesión.
// - Todo va bajo /<app>/ (BAS no recorta la ruta).
// - Cada petición trae el usuario firmado por BAS (X-BAS-Usuario); si no, 401.
// Variables: BAS_APP=planos, BAS_SECRETO_ARCHIVO=<clave>, PORT (5190), PLANOS_DATOS (carpeta data/ del repo).
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { crearVerificador } from "./bas-cliente.mjs";
import { crearAlmacen, ErrorPlanos, MAX_DATOS } from "./almacen.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(DIR, "..");
const PUBLICO = join(DIR, "public");
const MODULOS = join(RAIZ, "node_modules");
// Lo que se sirve desde node_modules: Three.js y las fuentes, en local (sin CDN).
const VENDOR = {
  "three/": join(MODULOS, "three"),
  "fuentes/bricolage-grotesque/": join(MODULOS, "@fontsource", "bricolage-grotesque"),
  "fuentes/ibm-plex-sans/": join(MODULOS, "@fontsource", "ibm-plex-sans"),
  "fuentes/ibm-plex-mono/": join(MODULOS, "@fontsource", "ibm-plex-mono"),
};
const PERMITIDO_VENDOR = /^(three\/(build|examples\/jsm)\/.+\.js|fuentes\/[a-z-]+\/(\d{3}\.css|files\/[\w-]+\.woff2?))$/;

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff" };

/** Hash del importmap del HTML, para permitirlo en la CSP sin abrir la puerta a otros scripts en línea. */
function cspDe(html) {
  const m = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html ?? "");
  const hash = m ? ` 'sha256-${createHash("sha256").update(m[1]).digest("base64")}'` : "";
  return `default-src 'self'; script-src 'self'${hash}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; ` +
    "connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
}

export function crearServidor({ app = "planos", secreto, secretoArchivo, dirDatos = join(RAIZ, "data") } = {}) {
  const BASE = `/${app}/`;
  const bas = crearVerificador({ app, secreto, secretoArchivo });
  const almacen = crearAlmacen(dirDatos);
  const indice = join(PUBLICO, "index.html");
  const SEGURIDAD = {
    "Content-Security-Policy": cspDe(existsSync(indice) ? readFileSync(indice, "utf8") : ""),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };

  function enviar(res, estado, cuerpo) {
    res.writeHead(estado, { ...SEGURIDAD, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(cuerpo));
  }
  function archivo(req, res, ruta, cache) {
    if (!existsSync(ruta) || statSync(ruta).isDirectory()) return enviar(res, 404, { error: "No existe." });
    res.writeHead(200, { ...SEGURIDAD, "Content-Type": TIPOS[extname(ruta)] ?? "application/octet-stream", "Cache-Control": cache });
    res.end(req.method === "HEAD" ? undefined : readFileSync(ruta));
  }
  function leerJSON(req) {
    return new Promise((ok, mal) => {
      const trozos = []; let total = 0;
      req.on("data", (t) => {
        total += t.length;
        if (total > MAX_DATOS + 64 * 1024) { mal(new ErrorPlanos(413, "El plano es demasiado grande.")); req.destroy(); return; }
        trozos.push(t);
      });
      req.on("end", () => {
        try { ok(total ? JSON.parse(Buffer.concat(trozos).toString("utf8")) : {}); }
        catch { mal(new ErrorPlanos(400, "La petición no es JSON válido.")); }
      });
      req.on("error", mal);
    });
  }

  async function api(req, res, u, partes) {
    const m = req.method;
    if (partes[0] === "yo" && partes.length === 1 && m === "GET") return enviar(res, 200, { usuario: u.usuario, nombre: u.nombre });
    if (partes[0] !== "proyectos") return enviar(res, 404, { error: "No existe." });
    const [, id, sub, otro] = partes;
    const cuerpo = ["POST", "PUT", "PATCH"].includes(m) ? await leerJSON(req) : null;
    if (!id) {
      if (m === "GET") return enviar(res, 200, almacen.lista(u));
      if (m === "POST") return enviar(res, 201, almacen.crear(u, cuerpo));
    } else if (!sub) {
      if (m === "GET") return enviar(res, 200, new URL(req.url, "http://x").searchParams.has("version") ? almacen.version(u, id) : almacen.obtener(u, id));
      if (m === "PUT") return enviar(res, 200, almacen.guardar(u, id, cuerpo));
      if (m === "PATCH") return enviar(res, 200, almacen.renombrar(u, id, cuerpo.nombre));
      if (m === "DELETE") return enviar(res, 200, almacen.borrar(u, id));
    } else if (sub === "compartir") {
      if (!otro && m === "POST") return enviar(res, 200, almacen.compartir(u, id, cuerpo));
      if (otro && m === "DELETE") return enviar(res, 200, almacen.quitar(u, id, otro));
    }
    return enviar(res, 405, { error: "Método no permitido." });
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (!url.pathname.startsWith(BASE)) return enviar(res, 404, { error: "No existe." });
      const u = bas.usuario(req);
      if (!u || !u.sub) return enviar(res, 401, { error: "Abre Planos desde BAS." });
      const ruta = decodeURIComponent(url.pathname.slice(BASE.length));
      if (ruta.includes("..") || ruta.includes("\\") || ruta.includes("\0")) return enviar(res, 404, { error: "No existe." });

      if (ruta.startsWith("api/")) {
        if (req.method !== "GET") {
          // Escrituras solo desde la propia página: JSON y nunca desde otra web.
          if (req.headers["sec-fetch-site"] === "cross-site") return enviar(res, 403, { error: "Petición no permitida." });
          if (req.method !== "DELETE" && !String(req.headers["content-type"] ?? "").startsWith("application/json"))
            return enviar(res, 415, { error: "Hace falta JSON." });
        }
        almacen.conocer(u);
        return await api(req, res, u, ruta.slice(4).split("/").filter(Boolean));
      }
      if (req.method !== "GET" && req.method !== "HEAD") return enviar(res, 405, { error: "Método no permitido." });

      if (ruta.startsWith("vendor/")) {
        const r = ruta.slice(7);
        if (!PERMITIDO_VENDOR.test(r)) return enviar(res, 404, { error: "No existe." });
        const pref = Object.keys(VENDOR).find((p) => r.startsWith(p));
        return archivo(req, res, join(VENDOR[pref], r.slice(pref.length)), "public, max-age=604800, immutable");
      }
      const destino = normalize(join(PUBLICO, ruta || "index.html"));
      if (!destino.startsWith(PUBLICO + sep)) return enviar(res, 404, { error: "No existe." });
      return archivo(req, res, destino, "no-cache");
    } catch (e) {
      if (e instanceof ErrorPlanos) return enviar(res, e.estado, { error: e.message, ...(e.extra ?? {}) });
      console.error(e);
      if (!res.headersSent) enviar(res, 500, { error: "Algo ha fallado en Planos." });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = process.env.BAS_APP ?? "planos";
  const secretoArchivo = process.env.BAS_SECRETO_ARCHIVO;
  if (!secretoArchivo) { console.error("Falta BAS_SECRETO_ARCHIVO: Planos solo funciona detrás de BAS."); process.exit(1); }
  const puerto = Number(process.env.PORT ?? 5190);
  const dirDatos = process.env.PLANOS_DATOS ?? join(RAIZ, "data");
  crearServidor({ app, secretoArchivo, dirDatos }).listen(puerto, "127.0.0.1",
    () => console.log(`Planos en marcha detrás de BAS: 127.0.0.1:${puerto}, ruta /${app}/`));
}
