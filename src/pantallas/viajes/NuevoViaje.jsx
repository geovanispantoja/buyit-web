import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, textoDeError } from "../../api";
import { useApp } from "../../contexto";
import { BarraTitulo } from "../../componentes/Cabecera";
import { Avatar, CampoMunicipio, Chip, Segmentado } from "../../componentes/piezas";
import { VEHICULOS, etiquetaVehiculo, pedirUbicacion } from "../../util";

/** Una fila de conductor para elegir (nombre, vehiculo, calificacion, viajes juntos, si esta en servicio). */
function OpcionConductor({ c, activa, onElegir }) {
  const datos = [
    etiquetaVehiculo(c.tipo_vehiculo),
    c.rating_prom ? `★ ${c.rating_prom}` : null,
    c.viajes_contigo > 0 ? `${c.viajes_contigo} viaje${c.viajes_contigo === 1 ? "" : "s"} contigo` : null,
  ].filter(Boolean);
  return (
    <button type="button" className={`opcion-cond ${activa ? "activa" : ""}`} onClick={() => onElegir(c)}>
      <Avatar nombre={c.nombre} tono={c.en_servicio ? "menta" : ""} />
      <div className="columna crece" style={{ gap: 2 }}>
        <span className="negrita">{c.nombre}</span>
        <span className="sub">{datos.join(" · ")}</span>
        <span><Chip tono={c.en_servicio ? "menta" : "gris"}>{c.en_servicio ? "● En servicio ahora" : "Fuera de servicio"}</Chip></span>
      </div>
      <span className="marca-radio" />
    </button>
  );
}

export default function NuevoViaje() {
  const { avisar } = useApp();
  const navegar = useNavigate();
  const estado = useLocation().state || {};
  const previo = estado.repetir || {};
  const [tipo, setTipo] = useState(previo.tipo_vehiculo || "bicitaxi");
  const [origenId, setOrigenId] = useState(previo.origen_municipio_id || null);
  const [destinoId, setDestinoId] = useState(previo.destino_municipio_id || null);
  const [origen, setOrigen] = useState(previo.origen || "");
  const [destino, setDestino] = useState(previo.destino || "");
  const [precio, setPrecio] = useState(previo.precio_actual ? String(previo.precio_actual) : "");
  const [conUbicacion, setConUbicacion] = useState(true);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // ---- ¿Con quien? (conductor de preferencia)
  // "Pedir de nuevo con Julio" llega con estado.conductor = { usuario_id, nombre, tipo_vehiculo }.
  const [conQuien, setConQuien] = useState(estado.conductor ? "preferido" : "cualquiera");
  const [preferido, setPreferido] = useState(estado.conductor || null);
  const [lista, setLista] = useState(null);
  const [errorLista, setErrorLista] = useState(null);
  const [verZona, setVerZona] = useState(false);

  useEffect(() => {
    if (conQuien !== "preferido") return;
    setErrorLista(null);
    api.conductoresParaElegir(origenId).then(setLista).catch(setErrorLista);
  }, [conQuien, origenId]);

  // Si el elegido aparece en la lista, se usan sus datos frescos (en servicio, ★...).
  const todos = [...(lista?.anteriores || []), ...(lista?.zona || [])];
  const elegido = preferido ? todos.find((c) => c.usuario_id === preferido.usuario_id) || preferido : null;
  const conPreferido = conQuien === "preferido" && elegido;
  const minutos = lista?.reservaMinutos ?? 5;
  // Con conductor elegido, el vehiculo es el suyo.
  const tipoFinal = conPreferido && elegido.tipo_vehiculo ? elegido.tipo_vehiculo : tipo;

  async function enviar() {
    setError(null);
    if (!origenId) return setError("Elige el municipio donde te recogen.");
    if (!origen.trim() || !destino.trim()) return setError("Escribe dónde te recogen y hacia dónde vas.");
    if (!(parseFloat(precio) > 0)) return setError("Escribe cuánto ofreces.");
    if (conQuien === "preferido" && !elegido) return setError("Elige el conductor, o cambia a «Cualquiera».");
    setEnviando(true);
    try {
      const gps = conUbicacion ? await pedirUbicacion() : null;
      await api.crearViaje({
        tipoVehiculo: tipoFinal,
        origenMunicipioId: origenId,
        destinoMunicipioId: destinoId || undefined,
        origen: origen.trim(),
        destino: destino.trim(),
        precio: parseFloat(precio),
        gpsLat: gps?.lat,
        gpsLng: gps?.lng,
        conductorPreferidoId: conPreferido ? elegido.usuario_id : undefined,
      });
      avisar(conPreferido ? `Se lo pediste a ${elegido.nombre}. Si no responde en ${minutos} min, lo ven todos.` : "Viaje publicado. Te avisamos cuando un conductor responda.");
      navegar("/viajes", { replace: true });
    } catch (e) {
      setError(textoDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="app">
      <BarraTitulo titulo="Solicitar viaje" />
      <div className="contenido">
        <section className="tarjeta">
          <span className="seccion" style={{ padding: 0 }}>Recorrido</span>
          <CampoMunicipio etiqueta="Municipio donde te recogen" valor={origenId} onCambio={setOrigenId} />
          <label className="campo">
            Te recojo en…
            <input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Ej.: esquina de 5ta y 42" />
          </label>
          <CampoMunicipio etiqueta="Municipio de destino (opcional)" valor={destinoId} onCambio={setDestinoId} />
          <label className="campo">
            Vas hacia…
            <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ej.: Terminal de Boyeros" />
          </label>
          <label className="fila texto-chico" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={conUbicacion} onChange={(e) => setConUbicacion(e.target.checked)} />
            Compartir mi ubicación para que el conductor me encuentre
          </label>
        </section>

        <section className="tarjeta">
          <span className="seccion" style={{ padding: 0 }}>¿Con quién?</span>
          <Segmentado opciones={[["cualquiera", "Cualquiera"], ["preferido", "Prefiero a…"]]} valor={conQuien} onCambio={setConQuien} />
          {conQuien === "cualquiera" && <span className="sub">Le llega a todos los conductores de la zona con el vehículo que elijas.</span>}
          {conQuien === "preferido" && (
            <>
              {!lista && !errorLista && <div className="vacio">Buscando conductores…</div>}
              {errorLista && <div className="error">{textoDeError(errorLista)}</div>}
              {/* El que vino de "Pedir de nuevo con…" y ya no sale en la lista, se muestra igual. */}
              {lista && preferido && !todos.some((c) => c.usuario_id === preferido.usuario_id) && (
                <OpcionConductor c={{ en_servicio: false, viajes_contigo: 0, ...preferido }} activa onElegir={setPreferido} />
              )}
              {lista?.anteriores?.length > 0 && <span className="negrita texto-chico">Conductores que ya te llevaron</span>}
              {lista?.anteriores?.map((c) => (
                <OpcionConductor key={c.usuario_id} c={c} activa={elegido?.usuario_id === c.usuario_id} onElegir={setPreferido} />
              ))}
              {lista && !origenId && <span className="sub">Elige arriba el municipio donde te recogen para ver también a los conductores de esa zona.</span>}
              {lista && origenId && lista.zona.length > 0 && (
                verZona || lista.anteriores.length === 0 ? (
                  <>
                    <span className="negrita texto-chico">Conductores de la zona</span>
                    {lista.zona.map((c) => (
                      <OpcionConductor key={c.usuario_id} c={c} activa={elegido?.usuario_id === c.usuario_id} onElegir={setPreferido} />
                    ))}
                  </>
                ) : (
                  <button className="btn texto" onClick={() => setVerZona(true)}>Ver conductores de la zona ({lista.zona.length}) ›</button>
                )
              )}
              {lista && origenId && lista.anteriores.length === 0 && lista.zona.length === 0 && (
                <div className="vacio">Todavía no hay conductores registrados en esa zona.</div>
              )}
              {elegido && (
                <div className="caja-ambar texto-chico">
                  <span>
                    Solo <b>{elegido.nombre}</b> verá tu viaje durante <b>{minutos} min</b>. Si no responde, se abre a todos los conductores.
                  </span>
                  {elegido.en_servicio === false && <span>Ahora está <b>fuera de servicio</b>: le llega el aviso igual, pero puede tardar en verlo.</span>}
                </div>
              )}
            </>
          )}
        </section>

        <section className="tarjeta">
          <span className="seccion" style={{ padding: 0 }}>Vehículo</span>
          {conPreferido && elegido.tipo_vehiculo ? (
            <span className="texto-chico"><b>{etiquetaVehiculo(elegido.tipo_vehiculo)}</b> · el de {elegido.nombre}</span>
          ) : (
            <div className="fila envuelve" style={{ gap: 8 }}>
              {VEHICULOS.map(([id, nombre]) => (
                <button key={id} className={`ficha ${tipo === id ? "activa" : ""}`} onClick={() => setTipo(id)}>{nombre}</button>
              ))}
            </div>
          )}
        </section>

        <section className="tarjeta">
          <label className="campo">
            Cuánto ofreces (CUP)
            <input inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value.replace(",", "."))} />
            <span className="ayuda">El conductor puede aceptarlo o proponerte otro precio. Pagas al llegar.</span>
          </label>
        </section>
        {error && <div className="error">{error}</div>}
        <button className="btn primario ancho" disabled={enviando} onClick={enviar}>
          {enviando ? "Publicando…" : conPreferido ? `Pedírselo a ${elegido.nombre}` : "Publicar viaje"}
        </button>
      </div>
    </div>
  );
}
