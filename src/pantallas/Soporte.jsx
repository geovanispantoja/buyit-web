import { useEffect, useState } from "react";
import { api, textoDeError } from "../api";
import { useApp } from "../contexto";
import { BarraTitulo } from "../componentes/Cabecera";
import { useSondeo } from "../util";

function diagnostico(sesion) {
  return {
    app: "web",
    version: import.meta.env.VITE_VERSION || "web",
    navegador: navigator.userAgent,
    instalada: window.matchMedia?.("(display-mode: standalone)").matches || false,
    rol: sesion?.usuario?.rolVisual,
    pantalla: `${window.innerWidth}x${window.innerHeight}`,
  };
}

export default function Soporte() {
  const { sesion, avisar } = useApp();
  const { datos, cargando, refrescar } = useSondeo(() => api.soporte(), 20000);
  const [hiloId, setHiloId] = useState(null);
  const [texto, setTexto] = useState("");
  const [asunto, setAsunto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const hilos = datos?.hilos || [];
  const hilo = hilos.find((h) => h.id === hiloId);

  useEffect(() => {
    if (hilo?.no_leido_usuario) api.soporteLeido(hilo.id).catch(() => {});
  }, [hilo?.id, hilo?.no_leido_usuario]);

  async function enviar() {
    if (!texto.trim()) return setError("Escribe tu mensaje.");
    setEnviando(true);
    setError(null);
    try {
      const r = await api.escribirSoporte(texto.trim(), hiloId || undefined, hiloId ? undefined : asunto.trim(), diagnostico(sesion));
      setTexto("");
      setAsunto("");
      setHiloId(r.hiloId);
      avisar("Mensaje enviado. Te respondemos aquí mismo.");
      refrescar();
    } catch (e) {
      setError(textoDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="app">
      <BarraTitulo titulo={hilo ? hilo.asunto || "Conversación" : "Soporte"} onVolver={hilo || hiloId === "nuevo" ? () => setHiloId(null) : undefined} />
      <div className="contenido">
        {!hilo && hiloId !== "nuevo" && (
          <>
            <span className="sub">Escríbenos si algo no funciona o tienes una duda. Te respondemos en esta misma pantalla.</span>
            <button className="btn primario ancho" onClick={() => setHiloId("nuevo")}>Escribir a soporte</button>
            {cargando && <div className="vacio">Cargando…</div>}
            {hilos.map((h) => (
              <button key={h.id} className="tarjeta tocable" style={{ textAlign: "left", border: "none" }} onClick={() => setHiloId(h.id)}>
                <div className="fila entre">
                  <span className="negrita">{h.asunto || "Conversación"}</span>
                  {h.no_leido_usuario && <span className="chip menta">Nueva respuesta</span>}
                </div>
                <span className="sub">{h.estado === "cerrado" ? "Cerrada" : "Abierta"} · {(h.soporte_mensajes || []).length} mensaje(s)</span>
              </button>
            ))}
          </>
        )}

        {hiloId === "nuevo" && (
          <section className="tarjeta">
            <label className="campo">
              Asunto (opcional)
              <input value={asunto} maxLength={120} onChange={(e) => setAsunto(e.target.value)} />
            </label>
            <label className="campo">
              Tu mensaje
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn primario ancho" disabled={enviando} onClick={enviar}>{enviando ? "Enviando…" : "Enviar"}</button>
          </section>
        )}

        {hilo && (
          <>
            {(hilo.soporte_mensajes || []).map((m) => (
              <div
                key={m.id}
                className="tarjeta"
                style={{
                  alignSelf: m.autor === "usuario" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: m.autor === "usuario" ? "var(--indigo-suave)" : "var(--superficie)",
                  padding: 12,
                  gap: 4,
                }}
              >
                <span className="sub negrita">{m.autor === "usuario" ? "Tú" : "Soporte Buy-iT"}</span>
                <span style={{ whiteSpace: "pre-wrap" }}>{m.texto}</span>
                <span className="sub">{new Date(m.creado_en).toLocaleString("es")}</span>
              </div>
            ))}
            <label className="campo">
              Responder
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn primario ancho" disabled={enviando} onClick={enviar}>{enviando ? "Enviando…" : "Enviar"}</button>
          </>
        )}
      </div>
    </div>
  );
}
