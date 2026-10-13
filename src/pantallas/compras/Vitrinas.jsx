import { useEffect, useState } from "react";
import { api, textoDeError } from "../../api";
import { Dialogo } from "../../componentes/piezas";
import { monto } from "../../util";

/** Nombre con el que un producto de la vitrina entra al pedido (regla: >100 letras se recorta a 40). */
export function nombreParaPedido(nombre) {
  const limpio = String(nombre || "").trim();
  return limpio.length > 100 ? limpio.slice(0, 40).trim() : limpio;
}

/** Vitrina de un agente/MiPyme, con "Añadir al pedido". */
export function VitrinaVendedor({ vendedorId, vendedorNombre, onAnadir, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [anadidos, setAnadidos] = useState([]);
  useEffect(() => {
    api.vitrinaDe(vendedorId).then(setDatos).catch(setError);
  }, [vendedorId]);
  return (
    <Dialogo titulo={`Vitrina de ${vendedorNombre}`} onCerrar={onCerrar}>
      {!datos && !error && <div className="vacio">Cargando…</div>}
      {error && <div className="error">{textoDeError(error)}</div>}
      {datos && datos.productos.length === 0 && <div className="vacio">Esta vitrina todavía no tiene productos.</div>}
      {datos?.productos.map((p) => (
        <div key={p.id} className="fila arriba" style={{ borderTop: "1px solid var(--linea-suave)", paddingTop: 10 }}>
          {p.foto_miniatura_url ? (
            <button style={{ border: "none", padding: 0, background: "none", cursor: "zoom-in" }} onClick={() => setZoom(p.foto_url || p.foto_miniatura_url)} aria-label={`Ver foto de ${p.nombre}`}>
              <img className="foto-producto" src={p.foto_miniatura_url} alt="" loading="lazy" />
            </button>
          ) : (
            <span className="foto-producto" />
          )}
          <div className="columna crece">
            <span className="negrita">{p.nombre}</span>
            {p.descripcion && <span className="sub">{p.descripcion}</span>}
            <span className="negrita menta">{monto(p.precio_cup)} CUP</span>
          </div>
          <button
            className={`btn chico ${anadidos.includes(p.id) ? "" : "lleno"}`}
            onClick={() => {
              onAnadir({ nombre: nombreParaPedido(p.nombre), cantidad: "1", tope: String(p.precio_cup) });
              setAnadidos((a) => [...a, p.id]);
            }}
          >
            {anadidos.includes(p.id) ? "Añadido ✓" : "Añadir"}
          </button>
        </div>
      ))}
      <button className="btn primario ancho" onClick={onCerrar}>Listo</button>
      {zoom && (
        <div className="velo" style={{ alignItems: "center", zIndex: 70 }} onClick={() => setZoom(null)}>
          <img src={zoom} alt="" style={{ maxWidth: "96vw", maxHeight: "90dvh", borderRadius: 12 }} />
        </div>
      )}
    </Dialogo>
  );
}

/** Elegir comprador de preferencia (los que ya me atendieron + los de la zona). */
export function ElegirPreferido({ municipioId, onElegir, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.compradoresParaElegir(municipioId).then(setDatos).catch(setError);
  }, [municipioId]);

  const Fila = ({ c }) => (
    <button className="tarjeta tocable" style={{ padding: 12, border: "1.5px solid var(--linea)", textAlign: "left" }} onClick={() => { onElegir(c); onCerrar(); }}>
      <div className="fila">
        <div className="columna crece" style={{ gap: 0 }}>
          <span className="negrita">{c.nombre}</span>
          <span className="sub">
            {c.rol} · {c.en_servicio ? "en servicio ahora" : "fuera de servicio"}
            {c.productos_vitrina > 0 ? ` · ${c.productos_vitrina} en vitrina` : ""}
          </span>
        </div>
        <span className={`punto ${c.en_servicio ? "" : "ambar"}`} />
      </div>
    </button>
  );

  return (
    <Dialogo titulo="Comprador de preferencia" onCerrar={onCerrar}>
      {!datos && !error && <div className="vacio">Cargando…</div>}
      {error && <div className="error">{textoDeError(error)}</div>}
      {datos && (
        <>
          <span className="sub">Solo él verá tu pedido durante {datos.exclusividadMinutos} minutos. Si no lo toma, se abre a todos los compradores de la zona.</span>
          {datos.anteriores.length > 0 && <span className="seccion" style={{ padding: 0 }}>Ya te atendieron</span>}
          {datos.anteriores.map((c) => <Fila key={c.usuario_id} c={c} />)}
          {!municipioId && <span className="sub">Elige primero el municipio de entrega para ver los compradores de esa zona.</span>}
          {municipioId && datos.zona.length > 0 && <span className="seccion" style={{ padding: 0 }}>En la zona</span>}
          {datos.zona.map((c) => <Fila key={c.usuario_id} c={c} />)}
          {municipioId && datos.zona.length === 0 && datos.anteriores.length === 0 && <div className="vacio">No hay compradores registrados en esa zona todavía.</div>}
        </>
      )}
      <button className="btn texto" onClick={onCerrar}>Cancelar</button>
    </Dialogo>
  );
}
