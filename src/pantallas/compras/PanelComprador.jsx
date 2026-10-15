import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, textoDeError } from "../../api";
import { useApp } from "../../contexto";
import { recordar, recuerdo } from "../../sesion";
import { Cabecera } from "../../componentes/Cabecera";
import { Avatar, Chip, Confirmar, Dialogo, DialogoCalificar, FotoPerfil, Segmentado } from "../../componentes/piezas";
import { abrirWhatsApp, etiquetaMunicipio, fechaCorta, hora12, horaDe, monto, pedirUbicacion, telefonoBonito, useSondeo } from "../../util";
import { gastado, productosDe, topeTotal, useOcultos } from "./comun";

const ESTADOS_EVENTO = {
  abortado: ["Abortado por ti", "gris"],
  declinado: ["Declinado por ti", "gris"],
  retirado: ["Se te retiró", "gris"],
  rechazado: ["Prefirió a otro", "gris"],
};

function CalificacionesCliente({ pedido, onDeclinar, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.calificacionesCliente(pedido.id).then(setDatos).catch(setError);
  }, [pedido.id]);
  return (
    <Dialogo titulo={`Cliente del pedido #${pedido.id}`} onCerrar={onCerrar}>
      {!datos && !error && <div className="vacio">Cargando…</div>}
      {error && <div className="error">{textoDeError(error)}</div>}
      {datos && (
        <>
          <span className="negrita">
            {datos.cantidad > 0 ? `★ ${Number(datos.promedio).toFixed(1)} · ${datos.cantidad} calificaci${datos.cantidad === 1 ? "ón" : "ones"}` : "Este cliente todavía no tiene calificaciones."}
          </span>
          {datos.calificaciones.map((c, i) => (
            <div key={i} className="renglon" style={{ alignItems: "flex-start" }}>
              <span className="negrita" style={{ color: "#f5b83d", whiteSpace: "nowrap" }}>★ {c.calificacion}</span>
              <span className="texto-chico crece">{c.nota || <span className="gris">Sin comentario</span>}</span>
            </div>
          ))}
        </>
      )}
      <button className="btn peligro ancho" onClick={onDeclinar}>No me interesa este pedido</button>
      <span className="sub">El pedido deja de salirte; el cliente no se entera.</span>
      <button className="btn primario ancho" onClick={onCerrar}>Cerrar</button>
    </Dialogo>
  );
}

function DialogoCategorias({ categorias, iniciales, onEntrar, onCerrar }) {
  const [elegidas, setElegidas] = useState(iniciales);
  return (
    <Dialogo titulo="¿Qué pedidos quieres recibir?" onCerrar={onCerrar}>
      <span className="sub">Si no marcas ninguna, recibes pedidos de todas las categorías.</span>
      <div className="fila envuelve" style={{ gap: 8 }}>
        {categorias.length === 0 && <span className="gris">(sin categorías todavía)</span>}
        {categorias.map((c) => (
          <button
            key={c.id}
            className={`ficha ${elegidas.includes(c.id) ? "activa" : ""}`}
            onClick={() => setElegidas((e) => (e.includes(c.id) ? e.filter((x) => x !== c.id) : [...e, c.id]))}
          >
            {c.texto_original}
          </button>
        ))}
      </div>
      <button className="btn primario ancho" onClick={() => onEntrar(elegidas)}>Entrar en servicio</button>
      <button className="btn texto" onClick={onCerrar}>Cancelar</button>
    </Dialogo>
  );
}

function DialogoMarcar({ producto, onGuardar, onCerrar }) {
  const [precio, setPrecio] = useState(producto.comprado ? String(producto.precioReal ?? "") : "");
  const [conUbicacion, setConUbicacion] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  return (
    <Dialogo titulo={producto.comprado ? "Editar precio" : "Marcar como comprado"} onCerrar={onCerrar}>
      <span className="negrita">{producto.nombre}{producto.detalle ? ` (${producto.detalle})` : ""}</span>
      <span className="sub">Cantidad {producto.cantidad} · tope {monto(producto.tope)} CUP c/u</span>
      <label className="campo">
        Precio real pagado (por unidad, CUP)
        <input autoFocus inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value.replace(",", "."))} />
      </label>
      <label className="fila texto-chico" style={{ cursor: "pointer" }}>
        <input type="checkbox" checked={conUbicacion} onChange={(e) => setConUbicacion(e.target.checked)} />
        Guardar dónde lo compré (el cliente lo ve en el mapa)
      </label>
      {error && <div className="error">{error}</div>}
      <button
        className="btn primario ancho"
        disabled={ocupado}
        onClick={async () => {
          const n = parseFloat(precio);
          if (!(n > 0)) return setError("Escribe el precio que pagaste.");
          if (n > producto.tope) return setError(`El precio supera el tope que puso el cliente (${monto(producto.tope)} CUP). Pídele que lo suba.`);
          setOcupado(true);
          setError(null);
          try {
            const gps = conUbicacion ? await pedirUbicacion() : null;
            await onGuardar(n, gps);
            onCerrar();
          } catch (e) {
            setError(textoDeError(e));
          } finally {
            setOcupado(false);
          }
        }}
      >
        {ocupado ? "Un momento…" : "Confirmar"}
      </button>
      <button className="btn texto" onClick={onCerrar}>Cancelar</button>
    </Dialogo>
  );
}

function PedidoActivo({ p, refrescar }) {
  const { avisar } = useApp();
  const [detalle, setDetalle] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api.pedido(p.id).then((r) => setDetalle(r)).catch(() => {});
  }, [p.id, p.version]);

  const productos = productosDe({ detalle_pedido: detalle?.detalle || p.detalle_pedido });
  const comprados = productos.filter((x) => x.comprado).length;
  const estado = p.estado;
  const esDigital = p.forma_pago === "digital";
  const puedeComprar = estado === "Aceptada" && (!esDigital || p.pago_confirmado_transportista);
  const titulo = p.destinatario_nombre || `Pedido #${p.id}`;
  const telCliente = p.cliente_telefono;
  const telDest = p.destinatario_telefono;
  const yaCalifique = recuerdo(`calificado_pedido_${p.id}`, false);

  async function accion(fn, ok) {
    setOcupado(true);
    try {
      await fn();
      if (ok) avisar(ok);
      refrescar();
    } catch (e) {
      avisar(textoDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  const chip =
    estado === "Reclamada" ? ["Esperando aprobación", "ambar"] : estado === "Aceptada" ? ["Aceptado", "menta"] : estado === "Terminada" ? ["Cerrado", "menta"] : ["Cancelado", "rojo"];

  return (
    <section className="tarjeta" style={{ borderRadius: 20 }}>
      <div className="columna" style={{ gap: 6 }}>
        <div className="fila entre">
          <Chip tono={chip[1]}>{chip[0]}</Chip>
          <span className="sub negrita">#{p.id}</span>
        </div>
        <span className="titulo grande">{titulo}</span>
        <span className="sub">{p.direccion} · {hora12(p.hora_entrega?.slice(0, 5))} {fechaCorta(p.fecha_entrega)}</span>
      </div>

      {estado === "Reclamada" && (
        <>
          <span className="texto-chico gris">
            El cliente está viendo tu nombre y tus calificaciones. Todavía no puedes marcar nada como comprado. Si no responde a tiempo, el pedido se libera solo; también puedes soltarlo ahora para tomar otro.
          </span>
          <button className="btn peligro ancho" disabled={ocupado} onClick={() => setDialogo("abortar")}>Soltar pedido y tomar otro</button>
        </>
      )}

      {(estado === "Aceptada" || estado === "Terminada") && (
        <div className="columna" style={{ gap: 8 }}>
          <div className="fila">
            <FotoPerfil telefono={telCliente} nombre={p.cliente_nombre || "C"} />
            <div className="columna crece" style={{ gap: 0 }}>
              <span className="negrita texto-chico">{p.cliente_nombre ? `${p.cliente_nombre} · pidió` : "Cliente · pidió"}</span>
              <span className="sub">{telefonoBonito(telCliente)}</span>
            </div>
            {telCliente && <button className="btn whatsapp" aria-label="WhatsApp con quien pidió" onClick={() => abrirWhatsApp(telCliente, `Hola, soy tu comprador del pedido #${p.id} de Buy-iT`)}>WhatsApp</button>}
          </div>
          {telDest && telDest !== telCliente && (
            <div className="fila">
              <Avatar nombre={p.destinatario_nombre} tono="ambar" tamano="chico" />
              <div className="columna crece" style={{ gap: 0 }}>
                <span className="negrita texto-chico">{p.destinatario_nombre || "Destinatario"} · recibe</span>
                <span className="sub">{telefonoBonito(telDest)}</span>
              </div>
              <button className="btn secundario" onClick={() => abrirWhatsApp(telDest)}>WhatsApp</button>
            </div>
          )}
        </div>
      )}

      {estado === "Aceptada" && comprados === 0 && (
        <button className="btn peligro ancho" disabled={ocupado} onClick={() => setDialogo("abortar")}>Abortar compra</button>
      )}

      {estado === "Aceptada" && esDigital && !p.pago_confirmado_transportista && (
        <div className="caja-ambar">
          <span className="negrita ambar">Pago por Zelle</span>
          {p.pago_confirmado_cliente ? (
            <>
              <span className="texto-chico">El cliente dice que ya pagó{p.referencia_pago ? ` (ref. ${p.referencia_pago})` : ""}. Cuando tu familia te confirme que le llegó, toca aquí:</span>
              <button className="btn primario" style={{ height: 44 }} disabled={ocupado} onClick={() => accion(() => api.pagoComprador(p.id), "Pago confirmado. Ya puedes comprar.")}>
                Confirmar que me pagaron
              </button>
            </>
          ) : (
            <span className="texto-chico">Esperando a que el cliente pague por Zelle — todavía no puedes comprar nada.</span>
          )}
        </div>
      )}

      {(puedeComprar || estado === "Terminada") && (
        <>
          <div className="columna" style={{ gap: 6 }}>
            <div className="fila entre texto-chico">
              <span className="negrita">{comprados} de {productos.length} comprados</span>
              <span className="gris negrita">{monto(gastado(productos))} / tope {monto(topeTotal(productos))} CUP</span>
            </div>
            <div className="barra"><div style={{ width: `${productos.length ? (comprados / productos.length) * 100 : 0}%` }} /></div>
          </div>
          <div>
            {productos.map((x) => (
              <div key={x.orden} className="renglon">
                <span className={`marca ${x.comprado ? "si" : ""}`}>{x.comprado ? "✓" : ""}</span>
                <div className="columna crece" style={{ gap: 0 }}>
                  <span className="negrita">{x.nombre}{x.detalle ? ` (${x.detalle})` : ""}</span>
                  {x.comprado ? (
                    <span className="sub menta negrita">{x.cantidad} × {monto(x.precioReal)} = {monto(x.cantidad * x.precioReal)} CUP · tope {monto(x.tope)}</span>
                  ) : (
                    <span className="sub">{x.cantidad} · tope {monto(x.tope)}{x.lugar ? ` · en ${x.lugar}` : ""}</span>
                  )}
                </div>
                {estado === "Aceptada" && (
                  <button className={`btn chico ${x.comprado ? "" : "lleno"}`} onClick={() => setDialogo({ marcar: x })}>
                    {x.comprado ? "Editar" : "Marcar"}
                  </button>
                )}
              </div>
            ))}
          </div>
          {estado === "Aceptada" && (
            <button className="btn fuerte ancho" onClick={() => setDialogo("cerrar")}>Cerrar pedido</button>
          )}
        </>
      )}

      {estado === "Terminada" && (
        <>
          <div className="caja-suave">
            {esDigital && p.gran_total_usd ? (
              <>
                <div className="fila entre texto-chico"><span className="gris">Gran total</span><span>{monto(p.gran_total)} CUP</span></div>
                <div className="fila entre"><span className="negrita">Cobrado por Zelle</span><span className="negrita menta">{monto(p.gran_total_usd)} USD</span></div>
              </>
            ) : (
              <>
                <div className="fila entre texto-chico"><span className="gris">Total de la compra</span><span>{monto(p.total_compra)} CUP</span></div>
                <div className="fila entre texto-chico"><span className="gris">Costo del servicio</span><span>{monto(p.costo_servicio)} CUP</span></div>
                <div className="fila entre"><span className="negrita">Gran total</span><span className="negrita menta">{monto(p.gran_total)} CUP</span></div>
              </>
            )}
          </div>
          {yaCalifique ? (
            <span className="texto-chico negrita menta">✓ Calificación enviada</span>
          ) : (
            <button className="btn primario ancho" onClick={() => setDialogo("calificar")}>Calificar cliente</button>
          )}
        </>
      )}

      {dialogo?.marcar && (
        <DialogoMarcar
          producto={dialogo.marcar}
          onCerrar={() => setDialogo(null)}
          onGuardar={async (precio, gps) => {
            await api.marcarProductos(p.id, [{ orden: dialogo.marcar.orden, precioReal: precio, comprado: true, ...(gps ? { gpsLat: gps.lat, gpsLng: gps.lng } : {}) }]);
            avisar("Producto marcado como comprado.");
            refrescar();
            api.pedido(p.id).then(setDetalle).catch(() => {});
          }}
        />
      )}
      {dialogo === "abortar" && (
        <Confirmar
          titulo={estado === "Reclamada" ? "¿Soltar este pedido?" : "¿Abortar esta compra?"}
          texto="El pedido vuelve a estar disponible para otros compradores."
          si={estado === "Reclamada" ? "Sí, soltarlo" : "Sí, abortar"}
          no="No, seguir con este"
          peligro
          onSi={async () => {
            await api.abortar(p.id);
            avisar("Listo. Ya puedes tomar otro pedido.");
            refrescar();
          }}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo === "cerrar" && (
        <Dialogo titulo={`Cerrar pedido #${p.id}`} onCerrar={() => setDialogo(null)}>
          <span>¿Se consiguió todo lo que pedía el cliente?</span>
          <button className="btn primario ancho" disabled={ocupado} onClick={() => { setDialogo(null); accion(() => api.cerrar(p.id, true), "Pedido cerrado."); }}>Sí, todo bien</button>
          <button className="btn secundario ancho" disabled={ocupado} onClick={() => { setDialogo(null); accion(() => api.cerrar(p.id, false), "Pedido cerrado sin éxito."); }}>No se consiguió</button>
          <button className="btn texto" onClick={() => setDialogo(null)}>Cancelar</button>
        </Dialogo>
      )}
      {dialogo === "calificar" && (
        <DialogoCalificar
          titulo="Calificar al cliente"
          pregunta="¿Cómo fue la experiencia con este cliente? Otros compradores lo verán antes de aceptar sus pedidos."
          onEnviar={async (n, nota) => {
            await api.calificar(p.id, n, nota);
            recordar(`calificado_pedido_${p.id}`, true);
            avisar("¡Gracias por calificar!");
            refrescar();
          }}
          onCerrar={() => setDialogo(null)}
        />
      )}
    </section>
  );
}

function TarjetaDisponible({ p, categorias, puedeAceptar, onAceptar, onVerCliente }) {
  const productos = productosDe(p);
  const categoria = categorias.find((c) => c.id === p.categoria_id)?.texto_original;
  return (
    <section className="tarjeta" style={{ borderRadius: 20 }}>
      {(categoria || p.coincide_vitrina) && (
        <div className="fila envuelve" style={{ gap: 6 }}>
          {categoria && <Chip tono="indigo">{categoria}</Chip>}
          {p.coincide_vitrina && <Chip tono="ambar">Coincide con tu vitrina: {p.coincide_vitrina}</Chip>}
        </div>
      )}
      <div className="fila arriba entre">
        <span className="titulo crece">#{p.id} · {p.municipio_etiqueta || etiquetaMunicipio(p.municipio_id)}</span>
        <span className="titulo" style={{ whiteSpace: "nowrap" }}>{monto(p.gran_total || topeTotal(productos))} <span className="sub">CUP</span></span>
      </div>
      <span className="sub">
        {hora12(p.hora_entrega?.slice(0, 5))} · {fechaCorta(p.fecha_entrega)} · {p.forma_pago === "digital" ? "Zelle" : "Presencial"} ·{" "}
        {p.cliente_rating_cantidad > 0 ? `Cliente ★ ${Number(p.cliente_rating_prom).toFixed(1)} (${p.cliente_rating_cantidad})` : "Cliente sin calificaciones"}
      </span>
      <div className="caja-suave" style={{ gap: 4 }}>
        {productos.map((x) => (
          <div key={x.orden} className="fila entre texto-chico">
            <span>{x.nombre} × {x.cantidad}</span>
            <span className="gris">tope {monto(x.tope)}</span>
          </div>
        ))}
      </div>
      <div className="rejilla-2">
        <button className="btn secundario" onClick={onVerCliente}>Calificaciones</button>
        <button className="btn primario" style={{ height: 44 }} disabled={!puedeAceptar} onClick={onAceptar}>Aceptar</button>
      </div>
      {!puedeAceptar && <span className="sub">Termina tu pedido activo para aceptar otro.</span>}
    </section>
  );
}

export default function PanelComprador() {
  const { sesion, avisar } = useApp();
  const navegar = useNavigate();
  const [categorias, setCategorias] = useState([]);
  const [dialogo, setDialogo] = useState(null);
  const [pestana, setPestana] = useState("pendientes");
  const [errorServicio, setErrorServicio] = useState(null);
  const mios = useSondeo(() => api.misPedidos(), 15000);
  const enServicio = !!mios.datos?.enServicio;
  const disp = useSondeo(() => (enServicio ? api.disponibles() : Promise.resolve({ pedidos: [] })), 15000, [enServicio]);
  const esVendedor = ["Agente de compras", "MiPyme"].includes(sesion.usuario.rolVisual);
  const opor = useSondeo(() => (esVendedor ? api.oportunidades() : Promise.resolve({ oportunidades: [] })), 45000);

  useEffect(() => {
    api.categorias().then((r) => setCategorias(r.categorias || [])).catch(() => {});
  }, []);

  const refrescar = () => {
    mios.refrescar();
    disp.refrescar();
  };

  const pedidos = mios.datos?.pedidos || [];
  const activo = pedidos.find((p) => p.estado === "Reclamada" || p.estado === "Aceptada");
  // Recien cerrado y sin calificar: se deja arriba para que califique.
  const recienCerrado = !activo && pedidos.find((p) => p.estado === "Terminada" && !recuerdo(`calificado_pedido_${p.id}`, false) && Date.now() - new Date(p.actualizado_en || p.creado_en).getTime() < 24 * 3600e3);
  const tarjetaActiva = activo || recienCerrado;
  const puedeAceptar = !activo;

  const historial = useMemo(() => {
    const filas = pedidos
      .filter((p) => p.id !== tarjetaActiva?.id)
      .map((p) => ({ id: p.id, alias: p.destinatario_nombre, direccion: p.direccion, estado: p.estado, gran_total: p.gran_total, productos: productosDe(p), pedido: p }));
    const ids = new Set(filas.map((f) => f.id));
    for (const e of mios.datos?.eventos || []) {
      if (ids.has(e.pedido_id)) continue;
      ids.add(e.pedido_id);
      filas.push({ id: e.pedido_id, alias: e.pedidos?.destinatario_nombre, direccion: e.pedidos?.direccion, estado: e.tipo, productos: productosDe(e.pedidos || {}), evento: e });
    }
    return filas.sort((a, b) => b.id - a.id);
  }, [pedidos, mios.datos?.eventos, tarjetaActiva?.id]);
  const pendientes = historial.filter((h) => h.estado === "Reclamada" || h.estado === "Aceptada");
  const { ocultos, ocultar } = useOcultos(`ocultos_comprador_${sesion.usuario.id}`, [...pendientes.map((h) => h.id), ...(activo ? [activo.id] : [])]);
  const terminados = historial.filter((h) => !(h.estado === "Reclamada" || h.estado === "Aceptada") && !ocultos.has(h.id));
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  async function cambiarServicio(activar, cats) {
    setErrorServicio(null);
    try {
      await api.servicio(activar, cats);
      if (cats) recordar("categorias_interes", cats);
      avisar(activar ? "Estás en servicio. Te avisamos de los pedidos nuevos." : "Saliste de servicio.");
      refrescar();
    } catch (e) {
      setErrorServicio(textoDeError(e));
    }
  }

  const prom = mios.datos?.miCalificacion;
  const subtitulo = `${sesion.usuario.rolVisual || "Comprador"}${prom?.cantidad ? ` · ★ ${prom.promedio} (${prom.cantidad})` : ""}`;
  const misMunicipios = mios.datos?.misMunicipios || sesion.usuario.municipiosCompras || [];
  const catsInteres = recuerdo("categorias_interes", []);
  const opNum = opor.datos?.oportunidades?.length || 0;

  return (
    <div className="app">
      <Cabecera subtitulo={subtitulo} colorAvatar="menta" />
      <div className="contenido">
        <section className={`servicio ${enServicio ? "encendido" : ""}`}>
          <div className="fila">
            <div className="columna crece" style={{ gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{enServicio ? "En servicio" : "Fuera de servicio"}</span>
              <span className="sub">
                {enServicio
                  ? mios.datos?.enServicioDesde ? `Desde ${horaDe(mios.datos.enServicioDesde)} · recibes avisos` : "Recibes avisos de pedidos nuevos"
                  : "Ponte en servicio para ver los pedidos disponibles"}
              </span>
            </div>
            <button
              className={`interruptor ${enServicio ? "si" : ""}`}
              role="switch"
              aria-checked={enServicio}
              aria-label={enServicio ? "Salir de servicio" : "Ponerme en servicio"}
              onClick={() => (enServicio ? cambiarServicio(false) : setDialogo("categorias"))}
            >
              <span />
            </button>
          </div>
          <div className="fila envuelve" style={{ gap: 6 }}>
            {misMunicipios.slice(0, 4).map((id) => <span key={id} className="etiqueta-servicio">{etiquetaMunicipio(id)}</span>)}
            {misMunicipios.length > 4 && <span className="etiqueta-servicio">+{misMunicipios.length - 4} más</span>}
            {catsInteres.length === 0 ? (
              <span className="etiqueta-servicio">Todas las categorías</span>
            ) : (
              catsInteres.slice(0, 3).map((id) => <span key={id} className="etiqueta-servicio">{categorias.find((c) => c.id === id)?.texto_original || "Categoría"}</span>)
            )}
          </div>
          {errorServicio && <div className="error">{errorServicio}</div>}
        </section>

        {esVendedor && (
          <button className="tarjeta tocable" style={{ background: "var(--indigo-suave)", border: "none", textAlign: "left", flexDirection: "row", alignItems: "center", boxShadow: "none" }} onClick={() => navegar("/compras/vitrina")}>
            <span className="avatar chico" style={{ borderRadius: 12 }}>▤</span>
            <span className="columna crece" style={{ gap: 0 }}>
              <span className="negrita">{opNum > 0 ? `${opNum} pedido${opNum === 1 ? "" : "s"} pide${opNum === 1 ? "" : "n"} algo de tu vitrina` : "Mi vitrina de productos"}</span>
              <span className="sub">{opNum > 0 ? (enServicio ? "Mi vitrina de productos" : "Ponte en servicio para verlos") : "Publica lo que tienes para vender"}</span>
            </span>
            <span style={{ fontSize: 20, color: "var(--indigo-fuerte)" }}>›</span>
          </button>
        )}

        {tarjetaActiva && (
          <>
            <span className="seccion">{activo ? "Mi pedido activo" : "Pedido recién cerrado"}</span>
            <PedidoActivo p={tarjetaActiva} refrescar={refrescar} />
          </>
        )}

        <span className="seccion">Pedidos disponibles{enServicio ? ` · ${disp.datos?.pedidos?.length || 0}` : ""}</span>
        {!enServicio && <div className="vacio">Ponte en servicio para ver los pedidos que hay disponibles ahora mismo.</div>}
        {enServicio && (disp.datos?.pedidos?.length || 0) === 0 && <div className="vacio">No hay pedidos disponibles en este momento.</div>}
        {enServicio &&
          (disp.datos?.pedidos || []).map((p) => (
            <TarjetaDisponible key={p.id} p={p} categorias={categorias} puedeAceptar={puedeAceptar} onAceptar={() => setDialogo({ aceptar: p })} onVerCliente={() => setDialogo({ cliente: p })} />
          ))}

        <span className="seccion">Mis pedidos</span>
        <Segmentado opciones={[["pendientes", `Pendientes · ${pendientes.length}`], ["historial", `Historial · ${terminados.length}`]]} valor={pestana} onCambio={setPestana} />
        {pestana === "historial" && terminados.length > 0 && (
          <button className="btn chico" style={{ alignSelf: "flex-end", color: "var(--rojo)" }} onClick={() => setConfirmarBorrar(true)}>
            Borrar historial
          </button>
        )}
        {(pestana === "pendientes" ? pendientes : terminados).length === 0 && (
          <div className="vacio">{historial.length === 0 ? "Todavía no has tomado ningún pedido." : pestana === "pendientes" ? "No tienes pedidos pendientes." : "Todavía no hay pedidos terminados."}</div>
        )}
        {(pestana === "pendientes" ? pendientes : terminados).map((h) => {
          const [chip, tono] =
            ESTADOS_EVENTO[h.estado] ||
            (h.estado === "Terminada" ? ["Terminado", "menta"] : h.estado === "Cancelada" ? ["Cancelado", "rojo"] : h.estado === "Aceptada" ? ["En curso", "menta"] : h.estado === "Reclamada" ? ["Esperando aprobación", "ambar"] : ["Pedido", "gris"]);
          return (
            <article key={`${h.id}-${h.estado}`} className="tarjeta tocable" onClick={() => setDialogo({ historial: h })}>
              <div><Chip tono={tono}>{chip}</Chip></div>
              <div className="columna" style={{ gap: 2 }}>
                <span className="titulo">{h.alias || `Pedido #${h.id}`}</span>
                <span className="sub">#{h.id} · {h.productos.length} producto{h.productos.length === 1 ? "" : "s"} · {h.estado === "Terminada" ? `${monto(h.gran_total)} CUP` : h.direccion}</span>
              </div>
            </article>
          );
        })}
      </div>

      {dialogo === "categorias" && (
        <DialogoCategorias categorias={categorias} iniciales={catsInteres} onCerrar={() => setDialogo(null)} onEntrar={(cats) => { setDialogo(null); cambiarServicio(true, cats); }} />
      )}
      {dialogo?.cliente && (
        <CalificacionesCliente
          pedido={dialogo.cliente}
          onCerrar={() => setDialogo(null)}
          onDeclinar={async () => {
            try {
              await api.declinar(dialogo.cliente.id);
              avisar("Ese pedido ya no te va a salir.");
              setDialogo(null);
              refrescar();
            } catch (e) {
              avisar(textoDeError(e));
            }
          }}
        />
      )}
      {dialogo?.aceptar && (
        <Confirmar
          titulo="¿Aceptar este pedido?"
          texto={
            <span className="columna">
              <span>#{dialogo.aceptar.id} · {dialogo.aceptar.municipio_etiqueta} · {hora12(dialogo.aceptar.hora_entrega?.slice(0, 5))} {fechaCorta(dialogo.aceptar.fecha_entrega)}</span>
              {productosDe(dialogo.aceptar).map((x) => (
                <span key={x.orden} className="texto-chico">• {x.nombre} × {x.cantidad} — tope {monto(x.tope)} CUP</span>
              ))}
              <span className="sub">Si el cliente no te eligió como su preferido, primero tiene que aprobarte.</span>
            </span>
          }
          si="Sí, aceptar"
          no="Cancelar"
          onSi={async () => {
            const r = await api.aceptar(dialogo.aceptar.id);
            avisar(r.autoAprobado ? "¡Es tuyo! El cliente te había elegido: ya puedes comprar." : "Listo. Esperando que el cliente te apruebe.");
            refrescar();
          }}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {confirmarBorrar && (
        <Confirmar
          titulo="¿Borrar historial?"
          texto="Se quitan de esta lista los pedidos que ya terminaron, y no vuelven a aparecer. El que tienes en curso se queda. No se borra nada en el servidor: el cliente y el panel los siguen viendo."
          si="Sí, borrar"
          no="Cancelar"
          peligro
          onSi={() => ocultar(terminados.map((h) => h.id))}
          onCerrar={() => setConfirmarBorrar(false)}
        />
      )}
      {dialogo?.historial && (
        <Dialogo titulo={`Pedido #${dialogo.historial.id}`} onCerrar={() => setDialogo(null)}>
          <span className="negrita">{dialogo.historial.alias}</span>
          <span className="sub">{dialogo.historial.direccion}</span>
          {dialogo.historial.productos.map((x) => (
            <div key={x.orden} className="fila entre texto-chico">
              <span>{x.comprado ? "✓ " : ""}{x.nombre} × {x.cantidad}</span>
              <span className="gris">{x.comprado ? `${monto(x.precioReal)} (tope ${monto(x.tope)})` : `tope ${monto(x.tope)}`}</span>
            </div>
          ))}
          {dialogo.historial.pedido?.estado === "Terminada" && (
            <div className="caja-suave">
              <div className="fila entre texto-chico"><span className="gris">Total de la compra</span><span>{monto(dialogo.historial.pedido.total_compra)} CUP</span></div>
              <div className="fila entre texto-chico"><span className="gris">Costo del servicio</span><span>{monto(dialogo.historial.pedido.costo_servicio)} CUP</span></div>
              <div className="fila entre"><span className="negrita">Gran total</span><span className="negrita menta">{monto(dialogo.historial.pedido.gran_total)} CUP</span></div>
              {dialogo.historial.pedido.gran_total_usd && <div className="fila entre texto-chico"><span className="gris">Cobrado por Zelle</span><span>{monto(dialogo.historial.pedido.gran_total_usd)} USD</span></div>}
            </div>
          )}
          <button className="btn primario ancho" onClick={() => setDialogo(null)}>Cerrar</button>
        </Dialogo>
      )}
    </div>
  );
}
