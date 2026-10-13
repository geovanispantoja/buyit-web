import { useEffect, useState } from "react";
import { api, textoDeError } from "../../api";
import { useApp } from "../../contexto";
import { recordar, recuerdo } from "../../sesion";
import { Cabecera } from "../../componentes/Cabecera";
import { Chip, Confirmar, Dialogo, DialogoCalificar, FotoPerfil } from "../../componentes/piezas";
import { VEHICULOS, abrirMapa, abrirWhatsApp, etiquetaMunicipio, etiquetaVehiculo, haceCuanto, monto, telefonoBonito, useSondeo } from "../../util";
import { ACTIVOS_VIAJE, CHIP_VIAJE, DialogoContraoferta, ruta } from "./comun";

/** Mientras el viaje esta aceptado y la app abierta, manda la ubicacion del conductor cada minuto. */
function useCompartirUbicacion(viajeId, activo) {
  useEffect(() => {
    if (!activo || !navigator.geolocation) return;
    let ultimo = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - ultimo < 60000) return;
        ultimo = Date.now();
        api.enviarUbicacion(viajeId, p.coords.latitude, p.coords.longitude).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [viajeId, activo]);
}

function MiViaje({ v, refrescar }) {
  const { avisar } = useApp();
  const [dialogo, setDialogo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [chip, tono] = CHIP_VIAJE[v.estado] || ["Viaje", "gris"];
  const yaCalifique = recuerdo(`calificado_viaje_${v.id}`, false);
  useCompartirUbicacion(v.id, v.estado === "aceptado");

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
      <div className="fila entre"><Chip tono={tono}>{chip}</Chip><span className="sub negrita">#{v.id}</span></div>
      <span className="titulo">{ruta(v)}</span>
      {v.gps_cliente_lat && v.gps_cliente_lng && ["negociando", "aceptado"].includes(v.estado) && (
        <button className="btn texto" style={{ alignSelf: "flex-start" }} onClick={() => abrirMapa(v.gps_cliente_lat, v.gps_cliente_lng)}>📍 Ver ubicación del cliente</button>
      )}

      {v.estado === "negociando" &&
        (v.ultima_oferta_de === "yo" ? (
          <div className="caja-suave">
            <span className="negrita">Le propusiste otro precio al cliente</span>
            <span>{monto(v.precio_actual)} CUP — esperando respuesta</span>
          </div>
        ) : (
          <div className="caja-ambar">
            <span className="negrita">El cliente propone otro precio</span>
            <span style={{ fontSize: 22, fontWeight: 800 }}>{monto(v.precio_actual)} CUP</span>
            <div className="rejilla-2">
              <button className="btn primario" style={{ height: 44 }} disabled={ocupado} onClick={() => accion(() => api.aceptarViaje(v.id), "¡Viaje confirmado!")}>Aceptar</button>
              <button className="btn secundario" disabled={ocupado} onClick={() => setDialogo("contra")}>Contraofertar</button>
            </div>
          </div>
        ))}

      {(v.estado === "aceptado" || v.estado === "en_curso") && (
        <>
          <span className="texto-chico">Confirmado: <b>{monto(v.precio_actual)} CUP</b> · cobras al llegar</span>
          {v.cliente_nombre && (
            <div className="fila">
              <FotoPerfil telefono={v.cliente_telefono} nombre={v.cliente_nombre} />
              <div className="columna crece" style={{ gap: 0 }}>
                <span className="negrita">{v.cliente_nombre}</span>
                <span className="sub">{telefonoBonito(v.cliente_telefono)}</span>
              </div>
              <button className="btn whatsapp" onClick={() => abrirWhatsApp(v.cliente_telefono, `Hola, soy tu conductor del viaje #${v.id} de Buy-iT`)}>WhatsApp</button>
            </div>
          )}
        </>
      )}
      {v.estado === "aceptado" && (
        <>
          <span className="sub">Mientras tengas esta pantalla abierta, el cliente puede ver dónde vienes.</span>
          <button className="btn primario ancho" disabled={ocupado} onClick={() => accion(() => api.iniciarViaje(v.id), "Viaje iniciado.")}>Ya lo recogí — iniciar viaje</button>
          <button className="btn peligro ancho" disabled={ocupado} onClick={() => setDialogo("soltar")}>Soltar este viaje</button>
        </>
      )}
      {v.estado === "en_curso" && (
        <button className="btn fuerte ancho" disabled={ocupado} onClick={() => accion(() => api.finalizarViaje(v.id), "Viaje terminado.")}>Terminar viaje</button>
      )}
      {v.estado === "finalizado" && (
        <>
          <span>Total: <b>{monto(v.precio_actual)} CUP</b></span>
          {yaCalifique ? <span className="texto-chico negrita menta">✓ Calificación enviada</span> : <button className="btn primario ancho" onClick={() => setDialogo("calificar")}>Calificar al cliente</button>}
        </>
      )}

      {dialogo === "contra" && (
        <DialogoContraoferta precioActual={v.precio_actual} onEnviar={async (n) => { await api.contraofertar(v.id, n); avisar("Propuesta enviada."); refrescar(); }} onCerrar={() => setDialogo(null)} />
      )}
      {dialogo === "soltar" && (
        <Confirmar titulo="¿Soltar este viaje?" texto="El viaje vuelve a publicarse para otros conductores." si="Sí, soltarlo" no="No" peligro
          onSi={async () => { await api.soltarViaje(v.id); avisar("Viaje soltado."); refrescar(); }} onCerrar={() => setDialogo(null)} />
      )}
      {dialogo === "calificar" && (
        <DialogoCalificar titulo="Calificar al cliente" pregunta="¿Cómo fue el viaje con este cliente?" notaObligatoria={false}
          onEnviar={async (n, nota) => { await api.calificarViaje(v.id, n, nota); recordar(`calificado_viaje_${v.id}`, true); avisar("¡Gracias por calificar!"); refrescar(); }}
          onCerrar={() => setDialogo(null)} />
      )}
    </section>
  );
}

export default function PanelConductor() {
  const { sesion, avisar } = useApp();
  const [dialogo, setDialogo] = useState(null);
  const mios = useSondeo(() => api.misViajes(), 10000);
  const perfil = mios.datos?.perfil;
  const enServicio = !!perfil?.enServicio;
  const disp = useSondeo(() => (enServicio ? api.viajesDisponibles() : Promise.resolve({ viajes: [] })), 10000, [enServicio]);
  const [vehiculo, setVehiculo] = useState(null);

  const viajes = mios.datos?.viajes || [];
  const activos = viajes.filter((v) => ACTIVOS_VIAJE.includes(v.estado));
  const porCalificar = viajes.filter((v) => v.estado === "finalizado" && !recuerdo(`calificado_viaje_${v.id}`, false) && Date.now() - new Date(v.finalizado_en || v.creado_en).getTime() < 6 * 3600e3);
  const historial = viajes.filter((v) => !activos.includes(v) && !porCalificar.includes(v));
  const ocupado = activos.some((v) => v.estado === "aceptado" || v.estado === "en_curso");

  async function servicio(activar, tipo) {
    try {
      await api.servicioViajes(activar, tipo);
      avisar(activar ? "Estás en servicio." : "Saliste de servicio.");
      mios.refrescar();
    } catch (e) {
      avisar(textoDeError(e));
    }
  }

  return (
    <div className="app">
      <Cabecera subtitulo={`${sesion.usuario.rolVisual || "Transportista"}${perfil?.tipoVehiculo ? ` · ${etiquetaVehiculo(perfil.tipoVehiculo)}` : ""}`} colorAvatar="menta" />
      <div className="contenido">
        <section className={`servicio ${enServicio ? "encendido" : ""}`}>
          <div className="fila">
            <div className="columna crece" style={{ gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{enServicio ? "En servicio" : "Fuera de servicio"}</span>
              <span className="sub">{enServicio ? `Con ${etiquetaVehiculo(perfil?.tipoVehiculo)} · recibes solicitudes` : "Ponte en servicio para ver solicitudes de viaje"}</span>
            </div>
            <button
              className={`interruptor ${enServicio ? "si" : ""}`}
              role="switch"
              aria-checked={enServicio}
              aria-label={enServicio ? "Salir de servicio" : "Ponerme en servicio"}
              onClick={() => {
                if (enServicio) servicio(false);
                else {
                  setVehiculo(perfil?.tipoVehiculo || sesion.usuario.tipoVehiculo || "bicitaxi");
                  setDialogo("vehiculo");
                }
              }}
            >
              <span />
            </button>
          </div>
          {perfil?.municipios?.length > 0 && (
            <div className="fila envuelve" style={{ gap: 6 }}>
              {perfil.municipios.slice(0, 5).map((id) => <span key={id} className="etiqueta-servicio">{etiquetaMunicipio(id)}</span>)}
              {perfil.municipios.length > 5 && <span className="etiqueta-servicio">+{perfil.municipios.length - 5} más</span>}
            </div>
          )}
        </section>

        {[...activos, ...porCalificar].length > 0 && <span className="seccion">Mis viajes en marcha</span>}
        {[...activos, ...porCalificar].map((v) => <MiViaje key={v.id} v={v} refrescar={() => { mios.refrescar(); disp.refrescar(); }} />)}

        <span className="seccion">Solicitudes cerca de ti{enServicio ? ` · ${disp.datos?.viajes?.length || 0}` : ""}</span>
        {!enServicio && <div className="vacio">Ponte en servicio para ver las solicitudes de viaje.</div>}
        {enServicio && (disp.datos?.viajes?.length || 0) === 0 && <div className="vacio">No hay solicitudes ahora mismo.</div>}
        {enServicio &&
          (disp.datos?.viajes || []).map((v) => (
            <section key={v.id} className="tarjeta" style={{ borderRadius: 20 }}>
              <div className="fila entre">
                <span className="titulo crece">{ruta(v)}</span>
                <span className="titulo" style={{ whiteSpace: "nowrap" }}>{monto(v.precio_actual)} <span className="sub">CUP</span></span>
              </div>
              <span className="sub">{etiquetaVehiculo(v.tipo_vehiculo)} · publicado {haceCuanto(v.creado_en)}</span>
              {v.gps_cliente_lat && v.gps_cliente_lng && (
                <button className="btn texto" style={{ alignSelf: "flex-start" }} onClick={() => abrirMapa(v.gps_cliente_lat, v.gps_cliente_lng)}>📍 Ver ubicación del cliente</button>
              )}
              <div className="rejilla-2">
                <button className="btn secundario" disabled={ocupado} onClick={() => setDialogo({ contra: v })}>Contraofertar</button>
                <button className="btn primario" style={{ height: 44 }} disabled={ocupado} onClick={async () => {
                  try { await api.aceptarViaje(v.id); avisar("¡Viaje confirmado! Ve a buscar al cliente."); mios.refrescar(); disp.refrescar(); } catch (e) { avisar(textoDeError(e)); }
                }}>Aceptar</button>
              </div>
              {ocupado && <span className="sub">Termina tu viaje actual para tomar otro.</span>}
            </section>
          ))}

        <span className="seccion">Historial</span>
        {historial.length === 0 && <div className="vacio">Todavía no hay viajes anteriores.</div>}
        {historial.map((v) => {
          const [chip, tono] = CHIP_VIAJE[v.estado] || ["Viaje", "gris"];
          return (
            <article key={v.id} className="tarjeta">
              <div className="fila entre"><Chip tono={tono}>{chip}</Chip><span className="sub">#{v.id}</span></div>
              <span className="negrita texto-chico">{ruta(v)}</span>
              <span className="sub">{monto(v.precio_actual)} CUP</span>
            </article>
          );
        })}
      </div>

      {dialogo === "vehiculo" && (
        <Dialogo titulo="¿Con qué vehículo trabajas hoy?" onCerrar={() => setDialogo(null)}>
          <div className="fila envuelve" style={{ gap: 8 }}>
            {VEHICULOS.map(([id, nombre]) => (
              <button key={id} className={`ficha ${vehiculo === id ? "activa" : ""}`} onClick={() => setVehiculo(id)}>{nombre}</button>
            ))}
          </div>
          <button className="btn primario ancho" onClick={() => { setDialogo(null); servicio(true, vehiculo); }}>Entrar en servicio</button>
          <button className="btn texto" onClick={() => setDialogo(null)}>Cancelar</button>
        </Dialogo>
      )}
      {dialogo?.contra && (
        <DialogoContraoferta precioActual={dialogo.contra.precio_actual}
          onEnviar={async (n) => { await api.contraofertar(dialogo.contra.id, n); avisar("Propuesta enviada al cliente."); mios.refrescar(); disp.refrescar(); }}
          onCerrar={() => setDialogo(null)} />
      )}
    </div>
  );
}
