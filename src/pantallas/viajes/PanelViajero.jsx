import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, textoDeError } from "../../api";
import { useApp } from "../../contexto";
import { recordar, recuerdo } from "../../sesion";
import { Cabecera } from "../../componentes/Cabecera";
import { Chip, Confirmar, DialogoCalificar, FotoPerfil } from "../../componentes/piezas";
import { abrirMapa, abrirWhatsApp, etiquetaVehiculo, haceCuanto, horaDe, monto, telefonoBonito, useSondeo } from "../../util";
import { ACTIVOS_VIAJE, CHIP_VIAJE, DialogoContraoferta, ruta } from "./comun";

function ViajeActivo({ v, refrescar }) {
  const { avisar } = useApp();
  const navegar = useNavigate();
  const [dialogo, setDialogo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [ubicacion, setUbicacion] = useState(null);
  const [chip, tono] = CHIP_VIAJE[v.estado] || ["Viaje", "gris"];
  const yaCalifique = recuerdo(`calificado_viaje_${v.id}`, false);

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

  return (
    <section className="tarjeta" style={{ borderRadius: 20 }}>
      <div className="fila entre">
        <Chip tono={tono}>{chip}</Chip>
        <span className="sub negrita">{etiquetaVehiculo(v.tipo_vehiculo)}</span>
      </div>
      <span className="titulo">{ruta(v)}</span>

      {v.estado === "buscando" && (
        <>
          <span className="texto-chico">Ofreces <b>{monto(v.precio_actual)} CUP</b>. Publicado {haceCuanto(v.creado_en)}{v.vence_en ? ` · vence a las ${horaDe(v.vence_en)}` : ""}.</span>
          <button className="btn peligro ancho" disabled={ocupado} onClick={() => setDialogo("cancelar")}>Cancelar viaje</button>
        </>
      )}

      {v.estado === "negociando" && (
        <>
          {v.ultima_oferta_de === "yo" ? (
            <div className="caja-suave">
              <span className="negrita">Le propusiste otro precio al conductor</span>
              <span>{monto(v.precio_actual)} CUP — esperando respuesta</span>
            </div>
          ) : (
            <div className="caja-ambar">
              <span className="negrita">El conductor propone otro precio</span>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{monto(v.precio_actual)} CUP</span>
              <div className="rejilla-2">
                <button className="btn primario" style={{ height: 44 }} disabled={ocupado} onClick={() => accion(() => api.aceptarViaje(v.id), "¡Listo! Conductor confirmado.")}>Aceptar</button>
                <button className="btn secundario" disabled={ocupado} onClick={() => setDialogo("contra")}>Contraofertar</button>
              </div>
            </div>
          )}
          <button className="btn peligro ancho" disabled={ocupado} onClick={() => setDialogo("cancelar")}>Cancelar viaje</button>
        </>
      )}

      {(v.estado === "aceptado" || v.estado === "en_curso") && (
        <>
          <span className="texto-chico">Precio acordado: <b>{monto(v.precio_actual)} CUP</b> · pagas al llegar</span>
          {v.conductor_nombre && (
            <div className="fila">
              <FotoPerfil telefono={v.conductor_telefono} nombre={v.conductor_nombre} tono="menta" />
              <div className="columna crece" style={{ gap: 0 }}>
                <span className="negrita">{v.conductor_nombre}</span>
                <span className="sub">{telefonoBonito(v.conductor_telefono)}</span>
              </div>
              <button className="btn whatsapp" onClick={() => abrirWhatsApp(v.conductor_telefono, `Hola, soy tu pasajero del viaje #${v.id} de Buy-iT`)}>WhatsApp</button>
            </div>
          )}
          {v.estado === "aceptado" && (
            <>
              <span className="sub">El conductor viene en camino a buscarte.</span>
              <button
                className="btn secundario ancho"
                disabled={ocupado}
                onClick={async () => {
                  setOcupado(true);
                  try {
                    const r = await api.ubicacionConductor(v.id);
                    setUbicacion(r);
                    abrirMapa(r.lat, r.lng);
                  } catch (e) {
                    avisar(textoDeError(e));
                  } finally {
                    setOcupado(false);
                  }
                }}
              >
                ¿Dónde viene?
              </button>
              {ubicacion && <span className="sub">Última ubicación: hace {ubicacion.haceMinutos} min.</span>}
            </>
          )}
          {v.estado === "en_curso" && <span className="negrita menta">Viaje en curso</span>}
        </>
      )}

      {v.estado === "finalizado" && (
        <>
          <span>Total: <b>{monto(v.precio_actual)} CUP</b></span>
          {yaCalifique ? <span className="texto-chico negrita menta">✓ Calificación enviada</span> : <button className="btn primario ancho" onClick={() => setDialogo("calificar")}>Calificar al conductor</button>}
          <button className="btn secundario ancho" onClick={() => navegar("/viajes/nuevo", { state: { repetir: v } })}>Pedir de nuevo este viaje</button>
        </>
      )}

      {v.estado === "no_publicada" && (
        <>
          <span className="texto-chico">Nadie tomó tu viaje a tiempo.</span>
          <button className="btn primario ancho" onClick={() => navegar("/viajes/nuevo", { state: { repetir: v } })}>Volver a publicar</button>
        </>
      )}

      {dialogo === "contra" && (
        <DialogoContraoferta precioActual={v.precio_actual} onEnviar={async (n) => { await api.contraofertar(v.id, n); avisar("Propuesta enviada."); refrescar(); }} onCerrar={() => setDialogo(null)} />
      )}
      {dialogo === "cancelar" && (
        <Confirmar titulo="¿Cancelar el viaje?" texto="Si ya hay un conductor negociando, se le avisa." si="Sí, cancelar" no="No" peligro
          onSi={async () => { await api.cancelarViaje(v.id); avisar("Viaje cancelado."); refrescar(); }} onCerrar={() => setDialogo(null)} />
      )}
      {dialogo === "calificar" && (
        <DialogoCalificar titulo="Calificar al conductor" pregunta="¿Cómo fue el viaje?"
          onEnviar={async (n, nota) => { await api.calificarViaje(v.id, n, nota); recordar(`calificado_viaje_${v.id}`, true); avisar("¡Gracias por calificar!"); refrescar(); }}
          onCerrar={() => setDialogo(null)} />
      )}
    </section>
  );
}

export default function PanelViajero() {
  const { sesion } = useApp();
  const navegar = useNavigate();
  const { datos, cargando, error, refrescar } = useSondeo(() => api.misViajes(), 10000);
  const viajes = datos?.viajes || [];
  const activos = viajes.filter((v) => ACTIVOS_VIAJE.includes(v.estado));
  // El ultimo terminado sin calificar (o no publicado) se deja arriba unas horas.
  const reciente = viajes.find(
    (v) => !ACTIVOS_VIAJE.includes(v.estado) && Date.now() - new Date(v.finalizado_en || v.vence_en || v.creado_en).getTime() < 6 * 3600e3 &&
      ((v.estado === "finalizado" && !recuerdo(`calificado_viaje_${v.id}`, false)) || v.estado === "no_publicada")
  );
  const destacados = [...activos, ...(reciente ? [reciente] : [])];
  const historial = viajes.filter((v) => !destacados.includes(v));

  return (
    <div className="app">
      <Cabecera subtitulo={sesion.usuario.rolVisual || "Viajero"} />
      <div className="contenido">
        <section className="heroe">
          <div className="columna">
            <span style={{ fontSize: 18, fontWeight: 800 }}>¿A dónde vas?</span>
            <span className="sub-heroe">Pide el vehículo que necesitas y negocia el precio con los conductores.</span>
          </div>
          <button className="btn blanco ancho" onClick={() => navegar("/viajes/nuevo")}>+ Solicitar viaje</button>
        </section>

        {cargando && <div className="vacio">Cargando…</div>}
        {error && !datos && <div className="error">{textoDeError(error)}</div>}
        {destacados.map((v) => <ViajeActivo key={v.id} v={v} refrescar={refrescar} />)}

        <span className="seccion">Mis viajes</span>
        {!cargando && historial.length === 0 && <div className="vacio">Todavía no hay viajes anteriores.</div>}
        {historial.map((v) => {
          const [chip, tono] = CHIP_VIAJE[v.estado] || ["Viaje", "gris"];
          return (
            <article key={v.id} className="tarjeta">
              <div className="fila entre"><Chip tono={tono}>{chip}</Chip><span className="sub">#{v.id}</span></div>
              <span className="negrita texto-chico">{ruta(v)}</span>
              <div className="fila entre">
                <span className="sub">{etiquetaVehiculo(v.tipo_vehiculo)} · {monto(v.precio_actual)} CUP</span>
                <button className="btn chico" onClick={() => navegar("/viajes/nuevo", { state: { repetir: v } })}>Pedir de nuevo</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
