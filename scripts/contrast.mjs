// Vérifie les contrastes WCAG des jetons de src/app/globals.css (clair et sombre).
// Usage : node scripts/contrast.mjs      (code de sortie 1 si une paire de texte < 4,5:1)
//
// Le script lit le CSS : il suit les var(--x) et calcule color-mix(in oklch, …),
// donc il n'y a pas de seconde copie de la palette à maintenir.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);

/** Contenu du premier bloc `{ … }` qui suit `selector`. */
function block(selector) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Bloc introuvable : ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`Bloc non fermé : ${selector}`);
}

function vars(body) {
  const out = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = vars(block(":root {"));
const dark = vars(block(':root[data-theme="dark"]'));
const darkMedia = vars(block(':root:not([data-theme="light"])'));

// --- couleurs -------------------------------------------------------------
const hexToRgb = (hex) => {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const unlin = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function toOklch(rgb) {
  const [r, g, b] = rgb.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: (Math.atan2(B, A) * 180) / Math.PI };
}
function fromOklch({ L, C, h }) {
  const A = C * Math.cos((h * Math.PI) / 180);
  const B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [r, g, b].map((c) => Math.min(1, Math.max(0, unlin(c))));
}
function mixOklch(a, pa, b) {
  const A = toOklch(a);
  const B = toOklch(b);
  const t = pa / 100;
  // Comme CSS : une teinte neutre (chroma ~ 0) prend la teinte de l'autre couleur.
  const hA = A.C < 1e-4 ? B.h : A.h;
  const hB = B.C < 1e-4 ? A.h : B.h;
  let d = hB - hA;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return fromOklch({
    L: A.L * t + B.L * (1 - t),
    C: A.C * t + B.C * (1 - t),
    h: hA + d * (1 - t),
  });
}

function resolve(value, scope, seen = new Set()) {
  const v = value.trim();
  if (v.startsWith("#")) return hexToRgb(v);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) {
    if (seen.has(ref[1])) throw new Error(`Boucle sur ${ref[1]}`);
    if (!(ref[1] in scope)) throw new Error(`Jeton inconnu ${ref[1]}`);
    return resolve(scope[ref[1]], scope, new Set(seen).add(ref[1]));
  }
  const mix = v.match(/^color-mix\(in oklch,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+)\)$/);
  if (mix) return mixOklch(resolve(mix[1], scope, seen), Number(mix[2]), resolve(mix[3], scope, seen));
  throw new Error(`Valeur non gérée : ${v}`);
}

const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// --- paires à vérifier ----------------------------------------------------
const TEXT = [
  "ink", "ink-2", "muted", "accent", "progress-text", "todo-text", "waiting-text",
  "done-text", "review-text", "danger-text", "soon-text",
];
const GROUNDS = ["surface", "bg", "sunken"];
const TONES = ["progress", "todo", "waiting", "done", "review", "danger", "soon"];

let failures = 0;
const lines = [];
const out = (s) => lines.push(s);

function run(name, scope) {
  out(`\n=== ${name} ===`);
  const get = (token) => resolve(`var(--${token})`, scope);
  const check = (fg, bg, min, label, info = false) => {
    const r = ratio(get(fg), get(bg));
    const ok = r >= min;
    if (!ok && !info) failures++;
    out(`${ok ? "ok  " : info ? "note" : "FAIL"} ${r.toFixed(2).padStart(5)}:1  ${label ?? `${fg} sur ${bg}`}  (min ${min})`);
  };
  for (const fg of TEXT) for (const bg of GROUNDS) check(fg, bg, 4.5);
  for (const t of TONES) check(`${t}-text`, `${t}-soft`, 4.5);
  check("accent-ink", "accent", 4.5, "accent-ink sur accent (bouton accent)");
  check("bg", "ink", 4.5, "bg sur ink (bouton principal, infobulle, pastille €)");
  check("ink", "accent-soft", 4.5);
  for (const bg of GROUNDS) check("faint", bg, 3, `faint sur ${bg} (icônes, 3:1 indicatif)`, true);
  for (const t of ["waiting", "done", "review", "danger", "soon", "progress"])
    check(t, "surface", 3, `${t} (solide) sur surface (forme, 3:1 indicatif)`, true);
}

run("clair", light);
const darkScope = { ...light, ...dark };
run("sombre", darkScope);

// Les deux déclarations du thème sombre doivent rester identiques.
const keys = new Set([...Object.keys(dark), ...Object.keys(darkMedia)]);
for (const k of keys) {
  if (dark[k] !== darkMedia[k]) {
    failures++;
    out(`FAIL parité sombre : ${k} diffère entre data-theme="dark" et prefers-color-scheme`);
  }
}

console.log(lines.join("\n"));
console.log(failures ? `\n${failures} échec(s)` : "\nTous les contrastes de texte sont conformes (AA).");
process.exit(failures ? 1 : 0);
