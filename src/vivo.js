// Avisos en vivo: mientras la app esta abierta, escucha el canal ntfy del usuario
// (el mismo que usa la app Android para sus notificaciones). Cada aviso hace que las
// pantallas se refresquen al instante y, si el usuario dio permiso, muestra una
// notificacion del navegador. Cerrada la app no llega nada (eso seria la fase de
// "push web"); por eso las pantallas tambien preguntan solas cada pocos segundos.
//
// Se usa fetch con la cabecera Authorization (lectura en streaming de /json) en vez de
// EventSource, que no permite cabeceras. Si el servidor ntfy no lo permitiera, no pasa
// nada: queda el sondeo normal.
import { api } from "./api";
import { pedirRefresco } from "./util";

let control = null;

export async function conectarAvisos() {
  desconectarAvisos();
  const miControl = new AbortController();
  control = miControl;
  let cfg;
  try {
    cfg = await api.pushConfig();
  } catch {
    return; // servidor sin notificaciones configuradas: se sigue solo con el sondeo
  }
  const url = `${cfg.url}/${encodeURIComponent(cfg.topic)}/json`;
  const cabecera = "Basic " + btoa(`${cfg.usuario}:${cfg.clave}`);

  let espera = 3000;
  while (!miControl.signal.aborted) {
    try {
      const r = await fetch(url, { headers: { Authorization: cabecera }, signal: miControl.signal, cache: "no-store" });
      if (!r.ok || !r.body) throw new Error(String(r.status));
      espera = 3000;
      const lector = r.body.getReader();
      const decodificador = new TextDecoder();
      let resto = "";
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        resto += decodificador.decode(value, { stream: true });
        const lineas = resto.split("\n");
        resto = lineas.pop();
        for (const linea of lineas) if (linea.trim()) atender(linea);
      }
    } catch {
      if (miControl.signal.aborted) return;
    }
    await new Promise((ok) => setTimeout(ok, espera));
    espera = Math.min(espera * 2, 60000);
  }
}

function atender(linea) {
  let msj;
  try {
    msj = JSON.parse(linea);
  } catch {
    return;
  }
  if (msj.event !== "message") return;
  pedirRefresco();
  if (document.visibilityState === "visible") {
    window.dispatchEvent(new CustomEvent("buyit:aviso", { detail: msj.title || msj.message || "Novedad" }));
  } else if ("Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker?.getRegistration().then((reg) => {
      const opciones = { body: msj.message || "", icon: "/iconos/icono-192.png", tag: String(msj.id || "") };
      if (reg) reg.showNotification(msj.title || "Buy-iT", opciones);
      else
        try {
          new Notification(msj.title || "Buy-iT", opciones);
        } catch {
          /* nada */
        }
    });
  }
}

export function desconectarAvisos() {
  if (control) {
    control.abort();
    control = null;
  }
}
