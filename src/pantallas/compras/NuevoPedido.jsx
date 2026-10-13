import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, textoDeError } from "../../api";
import { useApp } from "../../contexto";
import { BarraTitulo } from "../../componentes/Cabecera";
import { CampoMunicipio, Segmentado } from "../../componentes/piezas";
import { monto } from "../../util";
import { ElegirPreferido, VitrinaVendedor } from "./Vitrinas";

const filaVacia = () => ({ nombre: "", cantidad: "1", tope: "", detalle: "", lugar: "" });

function Cantidad({ valor, onCambio }) {
  const ajustar = (d) => {
    const n = Math.max(1, (parseFloat(valor) || 0) + d);
    onCambio(String(Number.isInteger(n) ? n : n.toFixed(2)));
  };
  return (
    <div className="stepper">
      <button type="button" aria-label="Menos" onClick={() => ajustar(-1)}>−</button>
      <input inputMode="decimal" aria-label="Cantidad" value={valor} onChange={(e) => onCambio(e.target.value.replace(",", "."))} />
      <button type="button" aria-label="Más" onClick={() => ajustar(1)}>+</button>
    </div>
  );
}

export default function NuevoPedido() {
  const { sesion, avisar } = useApp();
  const navegar = useNavigate();
  const esCubano = sesion.usuario.rolVisual === "Comprador cubano";

  const enTres = new Date(Date.now() + 3 * 3600 * 1000); // como la app: "ahora + 3 horas"
  const [alias, setAlias] = useState("");
  const [telDestinatario, setTelDestinatario] = useState("");
  const [direccion, setDireccion] = useState("");
  const [municipioId, setMunicipioId] = useState(null);
  const [categoriaId, setCategoriaId] = useState(null);
  const [hora, setHora] = useState(`${String(enTres.getHours()).padStart(2, "0")}:${String(enTres.getMinutes()).padStart(2, "0")}`);
  const [fecha, setFecha] = useState(
    `${enTres.getFullYear()}-${String(enTres.getMonth() + 1).padStart(2, "0")}-${String(enTres.getDate()).padStart(2, "0")}`
  );
  const [formaPago, setFormaPago] = useState("presencial");
  const [preferido, setPreferido] = useState(null);
  const [verPreferidos, setVerPreferidos] = useState(false);
  const [verVitrina, setVerVitrina] = useState(false);
  const [productos, setProductos] = useState([filaVacia()]);
  const [abierta, setAbierta] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [catalogo, setCatalogo] = useState({ productos: [], lugares: [] });
  const [enZona, setEnZona] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.categorias().then((r) => setCategorias(r.categorias || [])).catch(() => {});
    Promise.all([api.productosCatalogo(), api.lugaresCatalogo()])
      .then(([p, l]) => setCatalogo({ productos: p.productos || [], lugares: l.lugares || [] }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setEnZona(null);
    if (municipioId) api.compradoresEnServicio(municipioId, categoriaId).then((r) => setEnZona(r.cantidad)).catch(() => {});
  }, [municipioId, categoriaId]);

  const tope = useMemo(
    () => productos.reduce((s, p) => s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.tope) || 0), 0),
    [productos]
  );

  const cambiarFila = (i, cambios) => setProductos((ps) => ps.map((p, j) => (j === i ? { ...p, ...cambios } : p)));

  async function elegirContacto() {
    try {
      const [c] = await navigator.contacts.select(["tel"], { multiple: false });
      if (c?.tel?.[0]) setTelDestinatario(c.tel[0].replace(/[^\d+]/g, ""));
    } catch {
      /* cancelado */
    }
  }

  async function enviar() {
    setError(null);
    if (!alias.trim() || !direccion.trim() || !hora || !fecha) return setError("Falta el alias, la dirección, la hora o la fecha.");
    const cuando = new Date(`${fecha}T${hora}`);
    if (!(cuando.getTime() > Date.now())) return setError("La hora y fecha de entrega no pueden ser en el pasado.");
    if (!municipioId) return setError("Falta el municipio de entrega.");
    if (productos.some((p) => !p.nombre.trim() || !p.cantidad || !p.tope)) return setError("Cada producto necesita al menos qué es, cantidad y precio tope.");
    if (productos.some((p) => !(parseFloat(p.cantidad) > 0) || !(parseFloat(p.tope) > 0))) return setError("La cantidad y el precio tope tienen que ser números mayores que cero.");

    const [a, m, d] = fecha.split("-");
    setEnviando(true);
    try {
      await api.crearPedido({
        destinatarioNombre: alias.trim(),
        destinatarioTelefono: telDestinatario.trim(),
        categoriaId: categoriaId || undefined,
        direccion: direccion.trim(),
        horaEntrega: hora,
        fechaEntrega: `${d}/${m}/${a}`,
        formaPago: esCubano ? "presencial" : formaPago,
        municipioId,
        compradorPreferidoId: preferido?.usuario_id,
        productos: productos.map((p) => ({
          idOTexto: p.nombre.trim(),
          cantidad: p.cantidad,
          precioMaximo: p.tope,
          detalle: p.detalle.trim(),
          lugarIdOTexto: p.lugar.trim(),
        })),
      });
      avisar("Pedido enviado. Te avisamos cuando alguien lo tome.");
      navegar("/compras", { replace: true });
    } catch (e) {
      setError(textoDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="app">
      <BarraTitulo titulo="Nuevo pedido" />
      <datalist id="lista-productos">{catalogo.productos.map((p) => <option key={p.id} value={p.texto_original} />)}</datalist>
      <datalist id="lista-lugares">{catalogo.lugares.map((p) => <option key={p.id} value={p.texto_original} />)}</datalist>

      <div className="contenido">
        <section className="tarjeta">
          <span className="seccion" style={{ padding: 0 }}>Para quién</span>
          <label className="campo">
            Alias del destinatario
            <input value={alias} maxLength={20} onChange={(e) => setAlias(e.target.value)} placeholder="Ej.: víveres para Adda" />
            <span className="ayuda">Apodo corto de quien recibe (máx. 20 letras).</span>
          </label>
          <div className="fila arriba">
            <label className="campo crece">
              Teléfono de contacto (opcional)
              <input inputMode="tel" value={telDestinatario} onChange={(e) => setTelDestinatario(e.target.value)} />
            </label>
            {"contacts" in navigator && (
              <button type="button" className="btn chico" style={{ marginTop: 22, height: 48, background: "var(--indigo-suave)" }} onClick={elegirContacto} aria-label="Elegir de mis contactos">
                Contactos
              </button>
            )}
          </div>
          <label className="campo">
            Dirección de entrega
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </label>
          <CampoMunicipio etiqueta="Municipio de entrega" valor={municipioId} onCambio={setMunicipioId} />
          {enZona !== null && (
            <span className={`fila texto-chico negrita ${enZona === 0 ? "ambar" : "menta"}`} style={{ gap: 6 }}>
              <span className={`punto ${enZona === 0 ? "ambar" : ""}`} />
              {enZona === 0 ? "Ahora mismo no hay compradores en servicio en esa zona/categoría." : `${enZona} comprador${enZona === 1 ? "" : "es"} en servicio ahora mismo en esa zona/categoría.`}
            </span>
          )}
        </section>

        <section className="tarjeta">
          <span className="seccion" style={{ padding: 0 }}>Categoría (opcional)</span>
          <span className="sub">Le dice al comprador qué tipo de pedido es. Si mezclas cosas, déjalo sin categoría.</span>
          <div className="fila envuelve" style={{ gap: 8 }}>
            <button className={`ficha ${!categoriaId ? "activa" : ""}`} onClick={() => setCategoriaId(null)}>Sin categoría</button>
            {categorias.map((c) => (
              <button key={c.id} className={`ficha ${categoriaId === c.id ? "activa" : ""}`} onClick={() => setCategoriaId(c.id)}>
                {c.texto_original}
              </button>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <span className="seccion" style={{ padding: 0 }}>Cuándo y cómo pagas</span>
          <div className="rejilla-2">
            <label className="caja-valor">
              <span>Hora</span>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </label>
            <label className="caja-valor">
              <span>Fecha</span>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
          </div>
          {!esCubano && (
            <>
              <Segmentado opciones={[["presencial", "Presencial"], ["digital", "Digital (Zelle)"]]} valor={formaPago} onCambio={setFormaPago} />
              {formaPago === "digital" && (
                <span className="sub">Pagas por Zelle a la familia del comprador antes de que empiece a comprar. Te llega su contacto en cuanto alguien acepte.</span>
              )}
            </>
          )}
          <button className="caja-valor" style={{ textAlign: "left", cursor: "pointer", background: "var(--fondo)", border: "none" }} onClick={() => setVerPreferidos(true)}>
            <span>Comprador preferido (opcional)</span>
            <strong style={{ fontSize: 15 }}>{preferido ? preferido.nombre : "Ninguno — lo ve todo el mercado"}</strong>
          </button>
          {preferido && (
            <div className="fila">
              {preferido.productos_vitrina > 0 && (
                <button className="btn chico" onClick={() => setVerVitrina(true)}>Ver vitrina ({preferido.productos_vitrina})</button>
              )}
              <button className="btn texto" onClick={() => setPreferido(null)}>Quitar preferencia</button>
            </div>
          )}
        </section>

        <div className="fila entre" style={{ padding: "4px 4px 0" }}>
          <span className="seccion" style={{ padding: 0 }}>Productos · {productos.length}</span>
        </div>

        {productos.map((p, i) =>
          i !== abierta && p.nombre.trim() ? (
            <button key={i} className="tarjeta tocable" style={{ textAlign: "left", border: "none" }} onClick={() => setAbierta(i)}>
              <div className="fila">
                <div className="columna crece" style={{ gap: 0 }}>
                  <span className="titulo">{p.nombre}</span>
                  <span className="sub">
                    {p.cantidad || "?"} × tope {p.tope || "?"} CUP{p.detalle ? ` · ${p.detalle}` : ""}
                  </span>
                </div>
                <span className="texto-chico negrita" style={{ color: "var(--indigo)" }}>Editar</span>
              </div>
            </button>
          ) : (
            <section key={i} className="tarjeta borde-indigo">
              <div className="fila entre">
                <span className="texto-chico negrita gris">Producto {i + 1}</span>
                {productos.length > 1 && (
                  <button
                    className="boton-redondo"
                    style={{ width: 36, height: 36, background: "var(--rojo-suave)", color: "var(--rojo)", fontSize: 14 }}
                    aria-label="Quitar producto"
                    onClick={() => {
                      setProductos((ps) => ps.filter((_, j) => j !== i));
                      setAbierta(0);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <label className="campo">
                Qué es
                <input list="lista-productos" value={p.nombre} onChange={(e) => cambiarFila(i, { nombre: e.target.value })} />
              </label>
              <div className="fila arriba">
                <div className="campo">
                  Cantidad
                  <Cantidad valor={p.cantidad} onCambio={(v) => cambiarFila(i, { cantidad: v })} />
                </div>
                <label className="campo crece">
                  Precio tope c/u (CUP)
                  <input inputMode="decimal" value={p.tope} onChange={(e) => cambiarFila(i, { tope: e.target.value.replace(",", ".") })} />
                </label>
              </div>
              <label className="campo">
                Detalle (opcional): marca, tamaño…
                <input value={p.detalle} onChange={(e) => cambiarFila(i, { detalle: e.target.value })} />
              </label>
              <label className="campo">
                Dónde comprarlo (opcional)
                <input list="lista-lugares" value={p.lugar} onChange={(e) => cambiarFila(i, { lugar: e.target.value })} />
              </label>
            </section>
          )
        )}

        <button
          className="btn punteado ancho"
          onClick={() => {
            setProductos((ps) => [...ps, filaVacia()]);
            setAbierta(productos.length);
          }}
        >
          + Agregar producto
        </button>

        {error && <div className="error">{error}</div>}
      </div>

      <div className="pie-fijo">
        <div className="columna" style={{ gap: 0 }}>
          <span className="sub negrita">Tope total</span>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{monto(tope)} CUP</span>
        </div>
        <button className="btn primario crece" disabled={enviando} onClick={enviar}>
          {enviando ? "Enviando…" : "Enviar pedido"}
        </button>
      </div>

      {verPreferidos && <ElegirPreferido municipioId={municipioId} onElegir={setPreferido} onCerrar={() => setVerPreferidos(false)} />}
      {verVitrina && preferido && (
        <VitrinaVendedor
          vendedorId={preferido.usuario_id}
          vendedorNombre={preferido.nombre}
          onCerrar={() => setVerVitrina(false)}
          onAnadir={(prod) =>
            setProductos((ps) => {
              const fila = { ...filaVacia(), ...prod };
              const vacia = ps.findIndex((x) => !x.nombre.trim() && !x.tope);
              if (vacia >= 0) return ps.map((x, j) => (j === vacia ? fila : x));
              return [...ps, fila];
            })
          }
        />
      )}
    </div>
  );
}
