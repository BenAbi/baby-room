// Cliente de BAS para apps en Node, sin dependencias. Cópialo tal cual en cualquier app que vaya detrás de BAS.
//
// BAS manda en cada petición la cabecera X-BAS-Usuario = "v1.<datos>.<firma>", firmada con HMAC-SHA256
// y la clave secreta de ESTA app. Aquí se comprueba la firma, que la cabecera sea para esta app
// y que no haya caducado (60 s). Si falla, la petición no viene de BAS: se rechaza.
//
//   import { crearVerificador } from "./bas-cliente.mjs";
//   const bas = crearVerificador({ app: "mi-app", secretoArchivo: "../../data/secretos/mi-app.key" });
//   const usuario = bas.usuario(req);   // { sub, usuario, nombre, rol, app } o null
//   app.use(bas.middleware());          // Express: deja req.usuarioBAS o responde 401
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

export function verificarCabecera(token, secreto, app, ahora = Date.now()) {
  if (typeof token !== "string") return null;
  const [v, cuerpo, firma] = token.split(".");
  if (v !== "v1" || !cuerpo || !firma) return null;
  const esperada = createHmac("sha256", secreto).update(`v1.${cuerpo}`).digest();
  const recibida = Buffer.from(firma, "base64url");
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
  let datos;
  try { datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")); } catch { return null; }
  const t = Math.floor(ahora / 1000);
  if (datos.app !== app || typeof datos.exp !== "number" || datos.exp < t || datos.iat > t + 5) return null;
  return { sub: datos.sub, usuario: datos.usuario, nombre: datos.nombre, rol: datos.rol, app: datos.app };
}

export function crearVerificador({ app, secreto, secretoArchivo }) {
  const clave = secreto ?? readFileSync(secretoArchivo, "utf8").trim();
  if (!app || !clave || clave.length < 32) throw new Error("Falta la app o la clave secreta de BAS.");
  const usuario = (req) => verificarCabecera(req.headers["x-bas-usuario"], clave, app);
  return {
    usuario,
    /** Middleware para Express o similares: deja req.usuarioBAS o responde 401. */
    middleware() {
      return (req, res, next) => {
        const u = usuario(req);
        if (!u) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          return res.end(JSON.stringify({ error: "Abre esta app desde BAS." }));
        }
        req.usuarioBAS = u;
        next();
      };
    },
  };
}
