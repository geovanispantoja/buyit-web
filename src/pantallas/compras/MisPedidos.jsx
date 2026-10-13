import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, textoDeError } from "../../api";
import { useApp } from "../../contexto";
import { Cabecera } from "../../componentes/Cabecera";
import { Avatar, Chip, Segmentado } from "../../componentes/piezas";
import { haceCuanto, horaDe, monto, useSondeo } from "../../util";
import { CHIP_CLIENTE, FINALES, estadoPedido, productosDe, topeTotal } from "./comun";

/** Cuantos compradores hay en servicio para la zona/categoria de ESTE pedido. */
function CompradoresEnZona({ municipioId, categoriaId }) {
  const [n, setN] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (municipioId)
      api.compradoresEnServicio(municipioId, categoriaId).then((r) => vivo && setN(r.cantidad)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [municipioId, categoriaId]);
  if (n === null) return null;
  return (
    <span className={`fila texto-chico negrita ${n === 0 ? "ambar" : "menta"}`} style={{ gap: 6 }}>
      <span className={`punto ${n === 0 ? "ambar" : ""}`} />
      {n === 0 ? "Nadie en servicio ahí ahora mismo" : `${n} comprador${n === 1 ? "" : "es"} en servicio ahí`}
    </span>
  );
}

function TarjetaPedido({ p, onAbrir, refrescar }) {
  const { avisar } = useApp();
  const estado = estadoPedido(p);
  const productos = productosDe(p);
  const comprados = productos.filter((x) => x.comprado).length;
  const [chip, tono] = CHIP_CLIENTE[estado];
  const [ocupado, setOcupado] = useState(false);

  const meta = [
    `#${p.id}`,
    `${productos.length} producto${productos.length === 1 ? "" : "s"}`,
    estado === "cerrado" ? `${monto(p.gran_total)} CUP` : estado === "buscando" || estado === "reclamado" ? `tope ${monto(topeTotal(productos))} CUP` : p.direccion,
  ].join(" · ");

  async function accion(fn, ok) {
    setOcupado(true);
    try {
      await fn();
      avisar(ok);
      refrescar();
    } catch (e) {
      avisar(textoDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  const reservaVigente = p.en_exclusividad && p.preferido_hasta && new Date(p.preferido_hasta) > new Date();

  return (
    <article className="tarjeta tocable" onClick={onAbrir}>
      <div className="columna" style={{ gap: 6 }}>
        <div className="fila entre">
          <Chip tono={tono}>{chip}</Chip>
        </div>
        <div className="titulo">{p.destinatario_nombre || "Pedido"}</div>
        <div className="sub">{meta}</div>
      </div>

      {estado === "buscando" && (
        <div className="fila" onClick={(e) => e.stopPropagation()}>
          <div className="columna crece">
            <CompradoresEnZona municipioId={p.municipio_id} categoriaId={p.categoria_id} />
            <span className="sub">Enviado {haceCuanto(p.creado_en)}</span>
          </div>
        </div>
      )}

      {estado === "buscando" && reservaVigente && (
        <div className="caja-suave" onClick={(e) => e.stopPropagation()}>
          <span className="texto-chico">
            Reservado para {p.comprador_preferido_nombre || "tu comprador preferido"} hasta las {horaDe(p.preferido_hasta)}; si no lo toma, se abre a todos.
          </span>
          <button className="btn chico" style={{ alignSelf: "flex-start", background: "var(--indigo-suave)" }} disabled={ocupado} onClick={() => accion(() => api.abrirATodos(p.id), "Ahora todos los compradores de la zona pueden verlo.")}>
            Abrir a todos ahora
          </button>
        </div>
      )}

      {estado === "reclamado" && (
        <div className="columna" style={{ gap: 10 }} onClick={(e) => e.stopPropagation()}>
          <div className="fila caja-suave" style={{ flexDirection: "row" }}>
            <Avatar nombre={p.transportista_nombre} tono="suave" tamano="chico" />
            <div className="columna crece" style={{ gap: 0 }}>
              <span className="negrita texto-chico">{p.transportista_nombre || "Un comprador"} quiere comprarlo</span>
              <span className="sub">
                {p.transportista_cantidad_ratings > 0
                  ? `★ ${Number(p.transportista_promedio_rating).toFixed(1)} · ${p.transportista_cantidad_ratings} calificaci${p.transportista_cantidad_ratings === 1 ? "ón" : "ones"}`
                  : "Todavía no tiene calificaciones"}
              </span>
            </div>
          </div>
          <div className="rejilla-2">
            <button className="btn primario" style={{ height: 44 }} disabled={ocupado} onClick={() => accion(() => api.aprobar(p.id), "Aprobado. Ya puede empezar a comprar.")}>
              Aprobar
            </button>
            <button className="btn secundario" disabled={ocupado} onClick={() => accion(() => api.rechazar(p.id), "Listo: el pedido vuelve a estar disponible.")}>
              Prefiero a otro
            </button>
          </div>
        </div>
      )}

      {estado === "aceptado" && (
        <>
          <div className="columna" style={{ gap: 6 }}>
            <div className="tramos">
              <div className="lleno" />
              <div className="lleno" />
              <div className="lleno" />
              <div className={comprados === productos.length && productos.length > 0 ? "lleno" : ""} />
            </div>
            <div className="tramos-etiquetas">
              <span>Enviado</span>
              <span>Confirmado</span>
              <span>Comprando {comprados}/{productos.length}</span>
              <span>Listo</span>
            </div>
          </div>
          <div className="fila entre">
            <span className="fila texto-chico negrita">
              <Avatar nombre={p.transportista_nombre} tono="menta" tamano="mini" /> {p.transportista_nombre}
            </span>
            <span className="texto-chico negrita" style={{ color: "var(--indigo)" }}>Ver detalle ›</span>
          </div>
        </>
      )}

      {estado === "vencido" && (
        <div className="fila">
          <span className="texto-chico rojo crece">Pasó la hora sin compras: decide qué hacer.</span>
          <button className="btn chico">Decidir</button>
        </div>
      )}
    </article>
  );
}

export default function MisPedidos() {
  const { sesion } = useApp();
  const navegar = useNavigate();
  const [pestana, setPestana] = useState("activos");
  const { datos, error, cargando, refrescar } = useSondeo(() => api.misPedidos(), 15000);

  const pedidos = datos?.pedidos || [];
  const activos = pedidos.filter((p) => !FINALES.includes(estadoPedido(p)));
  const historial = pedidos.filter((p) => FINALES.includes(estadoPedido(p)));
  const lista = pestana === "activos" ? activos : historial;

  return (
    <div className="app">
      <Cabecera subtitulo={sesion.usuario.rolVisual || "Cliente"} />
      <div className="contenido">
        <section className="heroe">
          <div className="columna">
            <span style={{ fontSize: 18, fontWeight: 800 }}>¿Qué te compramos hoy?</span>
            <span className="sub-heroe">Dinos qué necesitas y un comprador de la zona lo consigue.</span>
          </div>
          <button className="btn blanco ancho" onClick={() => navegar("/compras/nuevo")}>+ Nuevo pedido</button>
        </section>

        <Segmentado
          opciones={[["activos", `Activos · ${activos.length}`], ["historial", `Historial · ${historial.length}`]]}
          valor={pestana}
          onCambio={setPestana}
        />

        {cargando && <div className="vacio">Cargando tus pedidos…</div>}
        {error && !datos && <div className="error">{textoDeError(error)}</div>}
        {!cargando && lista.length === 0 && (
          <div className="vacio">{pedidos.length === 0 ? "Todavía no has hecho ningún pedido." : pestana === "activos" ? "No tienes pedidos activos ahora mismo." : "Todavía no hay pedidos terminados."}</div>
        )}
        {lista.map((p) => (
          <TarjetaPedido key={p.id} p={p} refrescar={refrescar} onAbrir={() => navegar(`/compras/pedido/${p.id}`)} />
        ))}
      </div>
    </div>
  );
}
