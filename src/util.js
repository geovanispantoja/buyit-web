import { useEffect, useRef, useState, useCallback } from "react";
import { MUNICIPIOS } from "./datos/municipios";

/** 31800 -> "31 800"; 12.5 -> "12.5"; null -> "0" */
export function monto(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return String(valor ?? "0");
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 }).replace(/,/g, " ");
}

export function etiquetaMunicipio(id) {
  return MUNICIPIOS.find((m) => m.id === Number(id))?.etiqueta || "";
}

/** "14:30" -> "2:30 p. m." */
export function hora12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

/** "2026-10-13" -> "13/10/2026" */
export function fechaCorta(iso) {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : iso;
}

/** Fecha/hora ISO -> "hace 4 min" */
export function haceCuanto(iso) {
  const ms = new Date(iso).getTime();
  if (!ms) return "";
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.floor(min / 60)} h`;
  return `el ${new Date(ms).toLocaleDateString("es")}`;
}

export function horaDe(iso) {
  const d = new Date(iso);
  if (!d.getTime()) return "";
  return hora12(`${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
}

export function cantidadTexto(n) {
  const x = Number(n);
  return Number.isFinite(x) ? String(x) : String(n ?? "");
}

export function abrirWhatsApp(telefono, texto = "") {
  const limpio = String(telefono || "").replace(/[^\d]/g, "");
  if (!limpio) return;
  window.open(`https://wa.me/${limpio}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`, "_blank", "noopener");
}

export function abrirMapa(lat, lng) {
  window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`, "_blank", "noopener");
}

/** Pide la ubicacion del telefono (o null si no se puede / no la dan). */
export function pedirUbicacion(msMax = 12000) {
  return new Promise((resolver) => {
    if (!navigator.geolocation) return resolver(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolver(null),
      { enableHighAccuracy: true, timeout: msMax, maximumAge: 60000 }
    );
  });
}

/**
 * Corre `fn` ahora y cada `ms` mientras la pantalla este visible, y de inmediato al
 * volver a la app (igual que el ON_RESUME de Android). Devuelve { datos, error, cargando, refrescar }.
 */
export function useSondeo(fn, ms, deps = []) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const refrescar = useCallback(async () => {
    try {
      const d = await fnRef.current();
      setDatos(d);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    let temporizador;
    const ciclo = async () => {
      if (!vivo) return;
      if (document.visibilityState === "visible") await refrescar();
      if (vivo && ms) temporizador = setTimeout(ciclo, ms);
    };
    ciclo();
    const alVolver = () => document.visibilityState === "visible" && refrescar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("buyit:refrescar", refrescar);
    return () => {
      vivo = false;
      clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("buyit:refrescar", refrescar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { datos, error, cargando, refrescar, setDatos };
}

/** Pide a todas las pantallas abiertas que se refresquen (lo usa el aviso en vivo). */
export function pedirRefresco() {
  window.dispatchEvent(new Event("buyit:refrescar"));
}

/** Reduce una foto a JPEG de hasta `lado` px (como hace la app Android antes de subirla). */
export async function prepararFoto(archivo, lado = 1280, calidad = 0.82) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = mal;
      i.src = url;
    });
    const escala = Math.min(1, lado / Math.max(img.width, img.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const VEHICULOS = [
  ["bicitaxi", "Bicitaxi"],
  ["triciclo", "Triciclo"],
  ["moto", "Moto"],
  ["motorina", "Motorina"],
  ["carro", "Carro moderno"],
  ["almendron", "Almendrón"],
  ["camioneta", "Camioneta"],
  ["camion", "Camión"],
  ["carreton", "Carretón de caballo"],
];

export function etiquetaVehiculo(v) {
  return VEHICULOS.find(([id]) => id === v)?.[1] || v || "";
}

/** El backend guarda telefonos sin "+": para mostrarlos se lo ponemos. */
export function telefonoBonito(t) {
  if (!t) return "";
  const s = String(t);
  return s.startsWith("+") ? s : `+${s}`;
}

/** Cuenta regresiva hasta `hastaIso` ("4:12"), que se actualiza cada segundo. null si no hay fecha. */
export function useCuentaAtras(hastaIso) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    if (!hastaIso) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hastaIso]);
  if (!hastaIso) return null;
  const seg = Math.max(0, Math.round((new Date(hastaIso).getTime() - ahora) / 1000));
  return { seg, texto: `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}` };
}
