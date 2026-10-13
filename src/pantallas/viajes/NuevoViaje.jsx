import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, textoDeError } from "../../api";
import { useApp } from "../../contexto";
import { BarraTitulo } from "../../componentes/Cabecera";
import { CampoMunicipio } from "../../componentes/piezas";
import { VEHICULOS, pedirUbicacion } from "../../util";

export default function NuevoViaje() {
  const { avisar } = useApp();
  const navegar = useNavigate();
  const previo = useLocation().state?.repetir || {};
  const [tipo, setTipo] = useState(previo.tipo_vehiculo || "bicitaxi");
  const [origenId, setOrigenId] = useState(previo.origen_municipio_id || null);
  const [destinoId, setDestinoId] = useState(previo.destino_municipio_id || null);
  const [origen, setOrigen] = useState(previo.origen || "");
  const [destino, setDestino] = useState(previo.destino || "");
  const [precio, setPrecio] = useState(previo.precio_actual ? String(previo.precio_actual) : "");
  const [conUbicacion, setConUbicacion] = useState(true);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    if (!origenId) return setError("Elige el municipio donde te recogen.");
    if (!origen.trim() || !destino.trim()) return setError("Escribe dónde te recogen y hacia dónde vas.");
    if (!(parseFloat(precio) > 0)) return setError("Escribe cuánto ofreces.");
    setEnviando(true);
    try {
      const gps = conUbicacion ? await pedirUbicacion() : null;
      await api.crearViaje({
        tipoVehiculo: tipo,
        origenMunicipioId: origenId,
        destinoMunicipioId: destinoId || undefined,
        origen: origen.trim(),
        destino: destino.trim(),
        precio: parseFloat(precio),
        gpsLat: gps?.lat,
        gpsLng: gps?.lng,
      });
      avisar("Viaje publicado. Te avisamos cuando un conductor responda.");
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
          <span className="seccion" style={{ padding: 0 }}>Vehículo</span>
          <div className="fila envuelve" style={{ gap: 8 }}>
            {VEHICULOS.map(([id, nombre]) => (
              <button key={id} className={`ficha ${tipo === id ? "activa" : ""}`} onClick={() => setTipo(id)}>{nombre}</button>
            ))}
          </div>
        </section>
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
          <label className="campo">
            Cuánto ofreces (CUP)
            <input inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value.replace(",", "."))} />
            <span className="ayuda">Los conductores pueden aceptarlo o proponerte otro precio. Pagas al llegar.</span>
          </label>
        </section>
        {error && <div className="error">{error}</div>}
        <button className="btn primario ancho" disabled={enviando} onClick={enviar}>{enviando ? "Publicando…" : "Publicar viaje"}</button>
      </div>
    </div>
  );
}
