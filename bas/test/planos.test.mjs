// Pruebas del servidor de Planos: cabecera de BAS, aislamiento entre usuarios, compartir y versiones.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac, randomBytes } from "node:crypto";
import { crearServidor } from "../servidor.mjs";

const SECRETO = randomBytes(32).toString("hex");
const dir = mkdtempSync(join(tmpdir(), "planos-"));
let srv, base;

function firmar(datos, secreto = SECRETO, desfase = 0) {
  const iat = Math.floor(Date.now() / 1000) + desfase;
  const cuerpo = Buffer.from(JSON.stringify({ ...datos, iat, exp: iat + 60 })).toString("base64url");
  return `v1.${cuerpo}.${createHmac("sha256", secreto).update(`v1.${cuerpo}`).digest("base64url")}`;
}
const ANA = { sub: 1, usuario: "ana", nombre: "Ana", rol: "usuario", app: "planos" };
const BEA = { sub: 2, usuario: "bea", nombre: "Bea", rol: "usuario", app: "planos" };
const CAR = { sub: 3, usuario: "Carlos", nombre: "Carlos", rol: "usuario", app: "planos" };
const DATOS = { v: 4, rooms: [{ id: "r1", name: "Salón", W: 300, L: 300, layouts: [{ id: "l1", name: "Uno", items: [] }] }], roomId: "r1" };

async function pedir(quien, metodo, ruta, cuerpo, cab = {}) {
  const h = { ...cab };
  if (quien) h["x-bas-usuario"] = typeof quien === "string" ? quien : firmar(quien);
  if (cuerpo !== undefined) h["content-type"] = "application/json";
  const r = await fetch(base + ruta, { method: metodo, headers: h, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const tipo = r.headers.get("content-type") ?? "";
  return { estado: r.status, datos: tipo.includes("json") ? await r.json() : await r.text(), cabeceras: r.headers };
}

before(async () => {
  srv = crearServidor({ app: "planos", secreto: SECRETO, dirDatos: dir });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${srv.address().port}/planos/`;
});
after(() => { srv.close(); rmSync(dir, { recursive: true, force: true }); });

test("sin cabecera de BAS, o con una falsa, caducada o de otra app: 401", async () => {
  assert.equal((await pedir(null, "GET", "")).estado, 401);
  assert.equal((await pedir(null, "GET", "api/proyectos")).estado, 401);
  assert.equal((await pedir(firmar(ANA, randomBytes(32).toString("hex")), "GET", "api/yo")).estado, 401);
  assert.equal((await pedir(firmar(ANA, SECRETO, -120), "GET", "api/yo")).estado, 401);
  assert.equal((await pedir(firmar({ ...ANA, app: "ludoteca" }), "GET", "api/yo")).estado, 401);
  assert.equal((await pedir("v1.basura.firma", "GET", "api/yo")).estado, 401);
});

test("con cabecera válida: página, Three.js local, quién soy", async () => {
  const pag = await pedir(ANA, "GET", "");
  assert.equal(pag.estado, 200);
  assert.match(pag.datos, /<title>Planos<\/title>/);
  assert.match(pag.cabeceras.get("content-security-policy"), /script-src 'self' 'sha256-/);
  assert.equal((await pedir(ANA, "GET", "vendor/three/build/three.module.js")).estado, 200);
  assert.equal((await pedir(ANA, "GET", "vendor/three/package.json")).estado, 404);
  assert.equal((await pedir(ANA, "GET", "vendor/fuentes/ibm-plex-sans/400.css")).estado, 200);
  assert.equal((await pedir(ANA, "GET", "..%2F..%2Fpackage.json")).estado, 404);
  assert.deepEqual((await pedir(ANA, "GET", "api/yo")).datos, { usuario: "ana", nombre: "Ana" });
});

let idAna;
test("cada usuario ve y toca solo sus proyectos", async () => {
  const c = await pedir(ANA, "POST", "api/proyectos", { nombre: "  Casa   de Ana ", datos: DATOS });
  assert.equal(c.estado, 201);
  assert.equal(c.datos.nombre, "Casa de Ana");
  assert.equal(c.datos.version, 1);
  idAna = c.datos.id;
  assert.equal((await pedir(ANA, "GET", "api/proyectos")).datos.length, 1);
  assert.equal((await pedir(BEA, "GET", "api/proyectos")).datos.length, 0);
  assert.equal((await pedir(BEA, "GET", `api/proyectos/${idAna}`)).estado, 404);
  assert.equal((await pedir(BEA, "PUT", `api/proyectos/${idAna}`, { version: 1, datos: DATOS })).estado, 404);
  assert.equal((await pedir(BEA, "DELETE", `api/proyectos/${idAna}`)).estado, 404);
  assert.equal((await pedir(BEA, "PATCH", `api/proyectos/${idAna}`, { nombre: "Mío" })).estado, 404);
  assert.equal((await pedir(BEA, "POST", `api/proyectos/${idAna}/compartir`, { usuario: "bea", permiso: "editar" })).estado, 404);
  assert.equal((await pedir(ANA, "POST", "api/proyectos", { nombre: "Malo", datos: { rooms: [] } })).estado, 400);
  assert.equal((await pedir(ANA, "POST", "api/proyectos", { nombre: "", datos: DATOS })).estado, 400);
  const r = await pedir(ANA, "PATCH", `api/proyectos/${idAna}`, { nombre: "Piso" });
  assert.equal(r.datos.nombre, "Piso");
});

test("escrituras: solo JSON y nunca desde otra web", async () => {
  const r = await fetch(base + "api/proyectos", { method: "POST", headers: { "x-bas-usuario": firmar(ANA), "content-type": "text/plain" }, body: JSON.stringify({ nombre: "x", datos: DATOS }) });
  assert.equal(r.status, 415);
  assert.equal((await pedir(ANA, "POST", "api/proyectos", { nombre: "x", datos: DATOS }, { "sec-fetch-site": "cross-site" })).estado, 403);
});

test("guardar con versión: la segunda persona que guarda con una versión vieja recibe 409", async () => {
  const a = await pedir(ANA, "PUT", `api/proyectos/${idAna}`, { version: 1, datos: { ...DATOS, snap: 10 } });
  assert.equal(a.estado, 200);
  assert.equal(a.datos.version, 2);
  const b = await pedir(ANA, "PUT", `api/proyectos/${idAna}`, { version: 1, datos: DATOS });
  assert.equal(b.estado, 409);
  assert.equal(b.datos.version, 2);
  assert.equal((await pedir(ANA, "GET", `api/proyectos/${idAna}`)).datos.datos.snap, 10);
});

test("compartir: editor guarda, lector solo ve, el dueño quita el acceso", async () => {
  // Bea ya entró en Planos (se la conoce); Carlos todavía no.
  const e = await pedir(ANA, "POST", `api/proyectos/${idAna}/compartir`, { usuario: "@Bea", permiso: "editar" });
  assert.equal(e.estado, 200);
  assert.equal(e.datos.haEntrado, true);
  const l = await pedir(ANA, "POST", `api/proyectos/${idAna}/compartir`, { usuario: "carlos", permiso: "ver" });
  assert.equal(l.datos.haEntrado, false);
  assert.equal((await pedir(ANA, "POST", `api/proyectos/${idAna}/compartir`, { usuario: "ana", permiso: "ver" })).estado, 400);
  assert.equal((await pedir(ANA, "POST", `api/proyectos/${idAna}/compartir`, { usuario: "bea", permiso: "todo" })).estado, 400);

  const listaBea = (await pedir(BEA, "GET", "api/proyectos")).datos;
  assert.equal(listaBea.length, 1);
  assert.equal(listaBea[0].permiso, "editar");
  assert.equal(listaBea[0].dueno.nombre, "Ana");
  assert.equal(listaBea[0].compartidos, undefined); // solo el dueño ve con quién se comparte
  const g = await pedir(BEA, "PUT", `api/proyectos/${idAna}`, { version: 2, datos: { ...DATOS, snap: 1 } });
  assert.equal(g.estado, 200);
  assert.equal((await pedir(ANA, "GET", `api/proyectos/${idAna}?version`)).datos.editadoPor.nombre, "Bea");
  // Bea puede editar, pero no renombrar, borrar ni compartir.
  assert.equal((await pedir(BEA, "PATCH", `api/proyectos/${idAna}`, { nombre: "Mío" })).estado, 403);
  assert.equal((await pedir(BEA, "POST", `api/proyectos/${idAna}/compartir`, { usuario: "carlos", permiso: "editar" })).estado, 403);

  const vc = await pedir(CAR, "GET", `api/proyectos/${idAna}`);
  assert.equal(vc.estado, 200);
  assert.equal(vc.datos.permiso, "ver");
  assert.equal(vc.datos.datos.snap, 1);
  assert.equal((await pedir(CAR, "PUT", `api/proyectos/${idAna}`, { version: 3, datos: DATOS })).estado, 403);

  // El dueño ve los compartidos con su nombre en cuanto entran.
  const mios = (await pedir(ANA, "GET", "api/proyectos")).datos[0].compartidos;
  assert.deepEqual(mios.map((c) => [c.usuario, c.nombre, c.permiso]), [["bea", "Bea", "editar"], ["Carlos", "Carlos", "ver"]]);

  assert.equal((await pedir(ANA, "DELETE", `api/proyectos/${idAna}/compartir/bea`)).estado, 200);
  assert.equal((await pedir(BEA, "GET", `api/proyectos/${idAna}`)).estado, 404);
  assert.equal((await pedir(BEA, "GET", "api/proyectos")).datos.length, 0);

  // Quien lo tiene compartido puede dejar de verlo, sin borrarlo.
  assert.deepEqual((await pedir(CAR, "DELETE", `api/proyectos/${idAna}`)).datos, { dejado: true });
  assert.equal((await pedir(CAR, "GET", `api/proyectos/${idAna}`)).estado, 404);
  assert.equal((await pedir(ANA, "GET", `api/proyectos/${idAna}`)).estado, 200);
});

test("un compartido queda atado a la persona: otra cuenta con el mismo nombre no lo hereda", async () => {
  await pedir(ANA, "POST", `api/proyectos/${idAna}/compartir`, { usuario: "carlos", permiso: "ver" });
  const otro = { ...CAR, sub: 99, usuario: "carlos" };
  assert.equal((await pedir(otro, "GET", `api/proyectos/${idAna}`)).estado, 404);
});

test("los datos sobreviven a un reinicio y el dueño puede borrar", async () => {
  const srv2 = crearServidor({ app: "planos", secreto: SECRETO, dirDatos: dir });
  await new Promise((ok) => srv2.listen(0, "127.0.0.1", ok));
  const b2 = `http://127.0.0.1:${srv2.address().port}/planos/`;
  const r = await fetch(b2 + `api/proyectos/${idAna}`, { headers: { "x-bas-usuario": firmar(ANA) } });
  assert.equal((await r.json()).nombre, "Piso");
  srv2.close();
  assert.deepEqual((await pedir(ANA, "DELETE", `api/proyectos/${idAna}`)).datos, { borrado: true });
  assert.equal((await pedir(ANA, "GET", "api/proyectos")).datos.length, 0);
});
