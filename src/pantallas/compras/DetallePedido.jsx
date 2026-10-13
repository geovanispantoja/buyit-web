import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, textoDeError } from "../../api";
import { useApp } from "../../contexto";
import { recordar, recuerdo } from "../../sesion";
import { BarraTitulo } from "../../componentes/Cabecera";
import { Chip, Confirmar, Dialogo, DialogoCalificar, FotoPerfil } from "../../componentes/piezas";
import { abrirMapa, abrirWhatsApp, fechaCorta, hora12, monto, telefonoBonito, useSondeo } from "../../util";
import { CHIP_CLIENTE, estadoPedido, gastado, productosDe, topeTotal } from "./comun";

function CalificacionesComprador({ transportistaId, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.calificacionesComprador(transportistaId).then(setDatos).catch(setError);
  }, [transportistaId]);
  return (
    <Dialogo titulo="Calificaciones del comprador" onCerrar={onCerrar}>
      {!datos && !error && <div className="vacio">Cargando…</div>}
      {error && <div className="error">{textoDeError(error)}</div>}
      {datos && datos.calificaciones.length === 0 && <div className="vacio">Sin calificaciones todavía.</div>}
      {datos?.calificaciones.map((c, i) => (
        <div key={i} className="renglon" style={{ alignItems: "flex-start" }}>
          <span className="negrita" style={{ color: "#f5b83d", whiteSpace: "nowrap" }}>★ {c.calificacion}</span>
          <span className="texto-chico crece">{c.nota || <span className="gris">Sin comentario</span>}</span>
        </div>
      ))}
      <button className="btn primario ancho" onClick={onCerrar}>Cerrar</button>
    </Dialogo>
  );
}

export default function DetallePedido() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { avisar } = useApp();
  const lista = useSondeo(() => api.misPedidos(), 15000);
  const [detalle, setDetalle] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  const p = lista.datos?.pedidos?.find((x) => String(x.id) === String(id));

  useEffect(() => {
    api.pedido(id).then((r) => setDetalle(r.detalle || [])).catch(() => {});
  }, [id, p?.version]);

  if (lista.cargando) return <div className="cargando">Cargando…</div>;
  if (!p)
    return (
      <div className="app">
        <BarraTitulo titulo="Pedido" />
        <div className="contenido"><div className="vacio">No encontramos este pedido.</div></div>
      </div>
    );

  const estado = estadoPedido(p);
  const [chip, tono] = CHIP_CLIENTE[estado];
  // Los renglones con detalle y lugar vienen de /pedidos/:id; el avance, de la lista.
  const productos = productosDe({ detalle_pedido: detalle ? detalle.map((d) => ({ ...d, ...(p.detalle_pedido.find((x) => x.orden === d.orden) || {}) })) : p.detalle_pedido });
  const algunoComprado = productos.some((x) => x.comprado);
  const yaCalifique = recuerdo(`calificado_pedido_${p.id}`, false);
  const rolComprador = p.transportista_rol || "comprador";

  async function accion(fn, ok, despues) {
    setOcupado(true);
    setError(null);
    try {
      await fn();
      if (ok) avisar(ok);
      lista.refrescar();
      despues?.();
    } catch (e) {
      setError(textoDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="app">
      <BarraTitulo titulo={`Pedido #${p.id}`} />
      <div className="contenido">
        <section className="tarjeta">
          <div><Chip tono={tono}>{chip}</Chip></div>
          <div className="columna" style={{ gap: 2 }}>
            <span className="titulo grande">Para {p.destinatario_nombre}</span>
            <span className="texto-chico">{p.direccion}</span>
            <span className="sub">
              Entrega: {hora12(p.hora_entrega?.slice(0, 5))} · {fechaCorta(p.fecha_entrega)} · {p.forma_pago === "digital" ? "Pago por Zelle" : "Pago presencial"}
            </span>
          </div>
        </section>

        {error && <div className="error">{error}</div>}

        {estado === "vencido" && (
          <section className="tarjeta borde-rojo">
            <span className="negrita">
              {p.transportista_id ? "Pasó la hora de entrega y el comprador no marcó ninguna compra, así que se le retiró el pedido." : "Pasó la hora de entrega y ningún comprador tomó tu pedido."}
            </span>
            <span className="sub">Mientras decides, el pedido NO se ofrece a otros compradores.</span>
            <button className="btn primario ancho" onClick={() => setDialogo("decidir")}>Decidir qué hacer</button>
          </section>
        )}

        {estado === "reclamado" && (
          <section className="tarjeta">
            <span className="seccion" style={{ padding: 0 }}>Quiere comprarte</span>
            <div className="fila">
              <FotoPerfil telefono={p.transportista_telefono} nombre={p.transportista_nombre} />
              <div className="columna crece" style={{ gap: 0 }}>
                <span className="negrita">{p.transportista_nombre}</span>
                <span className="sub">{p.transportista_rol || "Comprador"}</span>
                <span className="texto-chico">
                  {p.transportista_cantidad_ratings > 0
                    ? `★ ${Number(p.transportista_promedio_rating).toFixed(1)} (${p.transportista_cantidad_ratings} calificaci${p.transportista_cantidad_ratings === 1 ? "ón" : "ones"})`
                    : "Todavía no tiene calificaciones"}
                </span>
              </div>
            </div>
            {p.transportista_cantidad_ratings > 0 && (
              <button className="btn texto" style={{ alignSelf: "flex-start" }} onClick={() => setDialogo("calificaciones")}>Ver calificaciones completas</button>
            )}
            <div className="rejilla-2">
              <button className="btn primario" style={{ height: 44 }} disabled={ocupado} onClick={() => accion(() => api.aprobar(p.id), "Aprobado. Ya puede empezar a comprar.")}>
                Aprobar
              </button>
              <button className="btn secundario" disabled={ocupado} onClick={() => accion(() => api.rechazar(p.id), "El pedido vuelve a estar disponible.", () => navegar("/compras"))}>
                Prefiero a otro
              </button>
            </div>
          </section>
        )}

        {(estado === "aceptado" || estado === "cerrado") && p.transportista_nombre && (
          <section className="tarjeta">
            <span className="seccion" style={{ padding: 0 }}>{estado === "aceptado" ? "Quién lo está comprando" : "Quién lo compró"}</span>
            <div className="fila">
              <FotoPerfil telefono={p.transportista_telefono} nombre={p.transportista_nombre} tono="menta" />
              <div className="columna crece" style={{ gap: 0 }}>
                <span className="negrita">{p.transportista_nombre}</span>
                <span className="sub">{p.transportista_rol || "Comprador"} · {telefonoBonito(p.transportista_telefono)}</span>
              </div>
              <button className="btn whatsapp" onClick={() => abrirWhatsApp(p.transportista_telefono, `Hola, sobre el pedido #${p.id} de Buy-iT`)}>
                WhatsApp
              </button>
            </div>

            {estado === "aceptado" && p.forma_pago === "digital" && (
              <div className="caja-ambar">
                {p.pago_confirmado_cliente ? (
                  <span className="texto-chico negrita menta">✓ Ya avisaste que pagaste. Esperando que el comprador lo confirme.</span>
                ) : (
                  <>
                    <span className="negrita ambar">Pago por Zelle</span>
                    <span className="texto-chico">A nombre de: <b>{p.zelle_nombre_contacto || "—"}</b></span>
                    <span className="texto-chico">Zelle: <b>{p.zelle_dato_contacto || "—"}</b></span>
                    <button className="btn primario" style={{ height: 44 }} onClick={() => setDialogo("pago")}>Ya pagué</button>
                  </>
                )}
              </div>
            )}

            {estado === "aceptado" && !algunoComprado && (
              <button className="btn peligro ancho" onClick={() => setDialogo("decidir")}>Retirar el pedido a este comprador</button>
            )}
          </section>
        )}

        <span className="seccion">Productos</span>
        <div className="tabla">
          <div className="tabla-fila cabeza">
            <span>Producto</span>
            <span>Cant.</span>
            <span>Tope</span>
            <span>Real</span>
          </div>
          {productos.map((x) => (
            <div key={x.orden} className="tabla-fila">
              <div className="columna" style={{ gap: 2, textAlign: "left" }}>
                <span className={`negrita texto-chico ${x.comprado ? "menta" : ""}`}>{x.comprado ? "✓ " : ""}{x.nombre}</span>
                {x.detalle && <span className="sub">{x.detalle}</span>}
                {x.comprado && <span className="sub">Importe: {monto(x.cantidad * x.precioReal)} CUP</span>}
                {x.comprado && x.gpsLat && x.gpsLng && (
                  <button className="btn texto" style={{ alignSelf: "flex-start", fontSize: 13 }} onClick={() => abrirMapa(x.gpsLat, x.gpsLng)}>Ver dónde se compró</button>
                )}
                {!x.comprado && estado === "aceptado" && (
                  <button className="btn texto" style={{ alignSelf: "flex-start", fontSize: 13 }} onClick={() => setDialogo({ tope: x })}>Subir el tope</button>
                )}
              </div>
              <span className="texto-chico">{x.cantidad}</span>
              <span className="texto-chico">{monto(x.tope)}</span>
              <span className={`texto-chico ${x.comprado ? "negrita menta" : "gris"}`}>{x.comprado ? monto(x.precioReal) : "—"}</span>
            </div>
          ))}
          <div className="tabla-fila pie">
            <span style={{ gridColumn: "span 2", textAlign: "left" }}>Total</span>
            <span className="texto-chico">{monto(topeTotal(productos))}</span>
            <span className="texto-chico menta">{algunoComprado ? monto(gastado(productos)) : "—"}</span>
          </div>
        </div>
        <span className="sub">Montos en CUP. «Tope» es lo máximo que aceptas pagar por unidad; «Real» es lo que pagó el comprador.</span>

        {estado === "cerrado" && (
          <section className="tarjeta">
            {p.forma_pago === "digital" && p.gran_total_usd ? (
              <>
                <div className="fila entre texto-chico"><span className="gris">Gran total</span><span>{monto(p.gran_total)} CUP</span></div>
                <div className="fila entre"><span className="negrita">Pagado por Zelle</span><span className="negrita menta">{monto(p.gran_total_usd)} USD</span></div>
              </>
            ) : (
              <>
                <div className="fila entre texto-chico"><span className="gris">Total de la compra</span><span>{monto(p.total_compra)} CUP</span></div>
                <div className="fila entre texto-chico"><span className="gris">Costo del servicio</span><span>{monto(p.costo_servicio)} CUP</span></div>
                <div className="fila entre"><span className="negrita">Gran total</span><span className="negrita menta">{monto(p.gran_total)} CUP</span></div>
              </>
            )}
            {yaCalifique ? (
              <span className="texto-chico negrita menta">✓ Calificación enviada</span>
            ) : (
              <button className="btn primario ancho" onClick={() => setDialogo("calificar")}>Calificar a {rolComprador}</button>
            )}
          </section>
        )}

        {estado === "buscando" && (
          <button className="btn peligro ancho" onClick={() => setDialogo("eliminar")}>Eliminar el pedido</button>
        )}
      </div>

      {dialogo === "calificaciones" && <CalificacionesComprador transportistaId={p.transportista_id} onCerrar={() => setDialogo(null)} />}

      {dialogo === "calificar" && (
        <DialogoCalificar
          titulo={`Calificar a ${rolComprador}`}
          pregunta={`¿Cómo fue la experiencia con ${p.transportista_nombre}?`}
          onEnviar={async (n, nota) => {
            await api.calificar(p.id, n, nota);
            recordar(`calificado_pedido_${p.id}`, true);
            avisar("¡Gracias por calificar!");
          }}
          onCerrar={() => setDialogo(null)}
        />
      )}

      {dialogo === "pago" && <DialogoPago id={p.id} onListo={() => { avisar("Avisamos al comprador que ya pagaste."); lista.refrescar(); }} onCerrar={() => setDialogo(null)} />}

      {dialogo?.tope && (
        <DialogoTope
          producto={dialogo.tope}
          onGuardar={(nuevo) => api.subirTope(p.id, dialogo.tope.orden, nuevo).then(() => { avisar("Tope actualizado."); lista.refrescar(); api.pedido(id).then((r) => setDetalle(r.detalle || [])); })}
          onCerrar={() => setDialogo(null)}
        />
      )}

      {dialogo === "eliminar" && (
        <Confirmar titulo="¿Eliminar el pedido?" texto="El pedido se cancela y no se puede recuperar." si="Sí, eliminar" no="No" peligro
          onSi={async () => { await api.cancelar(p.id); avisar("Pedido eliminado."); navegar("/compras", { replace: true }); }}
          onCerrar={() => setDialogo(null)} />
      )}

      {dialogo === "decidir" && (
        <Dialogo titulo={estado === "vencido" ? "¿Qué hacemos con el pedido?" : "Retirar el pedido a este comprador"} onCerrar={() => setDialogo(null)}>
          <span>
            {estado === "vencido"
              ? p.transportista_id ? "Se le retiró al comprador porque pasó la hora de entrega sin compras." : "Pasó la hora de entrega y ningún comprador tomó tu pedido."
              : "Solo se puede mientras el comprador no haya marcado ningún producto como comprado."}
          </span>
          <button className="btn primario ancho" disabled={ocupado} onClick={() => accion(() => api.reabrir(p.id), "Tu pedido quedó abierto a otros compradores.", () => setDialogo(null))}>
            Dejarlo abierto a otros
          </button>
          <span className="sub">Otros compradores podrán tomarlo. Si la hora de entrega ya pasó, se renueva a 2 horas desde ahora.</span>
          <button className="btn peligro ancho" disabled={ocupado} onClick={() => accion(() => api.cancelar(p.id), "Pedido eliminado.", () => navegar("/compras", { replace: true }))}>
            Eliminar el pedido
          </button>
          <span className="sub">El pedido se cancela y no se puede recuperar.</span>
          {p.forma_pago === "digital" && estado !== "vencido" && (
            <span className="texto-chico rojo">Si ya le pagaste por Zelle, ese dinero lo arreglan entre ustedes: la app no lo devuelve.</span>
          )}
          {error && <div className="error">{error}</div>}
          <button className="btn texto" onClick={() => setDialogo(null)}>Cerrar esta ventana</button>
        </Dialogo>
      )}
    </div>
  );
}

function DialogoPago({ id, onListo, onCerrar }) {
  const [ref, setRef] = useState("");
  return (
    <Confirmar
      titulo="Confirmar pago"
      texto={
        <>
          Avísale al comprador que ya hiciste la transferencia por Zelle.
          <label className="campo" style={{ marginTop: 12 }}>
            Referencia (opcional)
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Número de confirmación de Zelle" />
          </label>
        </>
      }
      si="Confirmar"
      no="Cancelar"
      onSi={async () => {
        await api.pagoCliente(id, ref.trim());
        onListo();
      }}
      onCerrar={onCerrar}
    />
  );
}

function DialogoTope({ producto, onGuardar, onCerrar }) {
  const [valor, setValor] = useState(String(producto.tope));
  const [error, setError] = useState(null);
  return (
    <Dialogo titulo="Subir el tope de precio" onCerrar={onCerrar}>
      <span className="texto-chico">{producto.nombre}: hoy el tope es {monto(producto.tope)} CUP por unidad.</span>
      <label className="campo">
        Nuevo tope (CUP)
        <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value.replace(",", "."))} />
      </label>
      {error && <div className="error">{error}</div>}
      <button
        className="btn primario ancho"
        onClick={async () => {
          const n = parseFloat(valor);
          if (!(n > producto.tope)) return setError("El nuevo tope tiene que ser mayor que el actual.");
          try {
            await onGuardar(n);
            onCerrar();
          } catch (e) {
            setError(textoDeError(e));
          }
        }}
      >
        Confirmar
      </button>
      <button className="btn texto" onClick={onCerrar}>Cancelar</button>
    </Dialogo>
  );
}
