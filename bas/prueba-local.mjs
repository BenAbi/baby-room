// Prueba local de Planos sin BAS: un mini-proxy en 127.0.0.1 que firma X-BAS-Usuario como lo haría BAS,
// con usuarios de prueba (ana, bea, carlos). Datos en data/prueba/ (fuera de git), clave nueva cada vez.
//   node bas/prueba-local.mjs   →   http://127.0.0.1:5191/planos/?como=ana
// Cambia de usuario con ?como=bea (se recuerda en una cookie de prueba).
import http from "node:http";
import { createHmac, randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { crearServidor } from "./servidor.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const secreto = randomBytes(32).toString("hex");
const USUARIOS = { ana: { sub: 9001, nombre: "Ana (prueba)" }, bea: { sub: 9002, nombre: "Bea (prueba)" }, carlos: { sub: 9003, nombre: "Carlos (prueba)" } };
const app = crearServidor({ app: "planos", secreto, dirDatos: join(RAIZ, "data", "prueba") });
app.listen(0, "127.0.0.1", () => {
  const puertoApp = app.address().port;
  http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const cookie = /(?:^|;\s*)como=([a-z]+)/.exec(req.headers.cookie ?? "")?.[1];
    const como = USUARIOS[url.searchParams.get("como")] ? url.searchParams.get("como") : USUARIOS[cookie] ? cookie : "ana";
    const u = USUARIOS[como];
    const iat = Math.floor(Date.now() / 1000);
    const cuerpo = Buffer.from(JSON.stringify({ sub: u.sub, usuario: como, nombre: u.nombre, rol: "usuario", app: "planos", iat, exp: iat + 60 })).toString("base64url");
    const headers = { ...req.headers, "x-bas-usuario": `v1.${cuerpo}.${createHmac("sha256", secreto).update(`v1.${cuerpo}`).digest("base64url")}` };
    const p = http.request({ host: "127.0.0.1", port: puertoApp, method: req.method, path: req.url, headers }, (r) => {
      const h = { ...r.headers };
      if (url.searchParams.has("como")) h["set-cookie"] = `como=${como}; Path=/; SameSite=Lax`;
      res.writeHead(r.statusCode, h); r.pipe(res);
    });
    req.pipe(p);
  }).listen(5191, "127.0.0.1", () => console.log("Prueba local de Planos: http://127.0.0.1:5191/planos/?como=ana"));
});
