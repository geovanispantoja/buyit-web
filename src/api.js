// Cliente de la API de Buy-iT. Todo va a /api del MISMO dominio: en el VPS,
// nginx lo reenvia al backend de Vercel; en desarrollo lo hace Vite.
import { leerSesion } from "./sesion";

export class ErrorApi extends Error {
  constructor(mensaje, { estado, codigo, motivo, sinConexion } = {}) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.motivo = motivo;
    this.sinConexion = !!sinConexion;
  }
}

let alExpirar = null;
/** La app registra aqui que hacer si el servidor dice "no autenticado" (sesion vencida). */
export function cuandoExpireSesion(fn) {
  alExpirar = fn;
}

const TEXTOS_MOTIVO = {
  SALDO_SMS_AGOTADO: "Tu saldo se agotó. Escribe a soporte para recargarlo.",
  YA_TOMADO: "Otro comprador tomó este pedido primero.",
  PEDIDO_CANCELADO: "Este pedido ya fue cancelado.",
  PEDIDO_RESERVADO: "Este pedido está reservado unos minutos para otro comprador.",
  PEDIDO_VENCIDO: "A este pedido ya le pasó la hora de entrega.",
  DIGITAL_NO_HABILITADO: "Todavía no estás habilitado para pedidos con pago por Zelle.",
  EXCEDE_FIANZA: "Este pedido supera tu límite para pagos por Zelle.",
  VIAJE_NO_DISPONIBLE: "Este viaje ya no está disponible.",
  VIAJE_YA_TOMADO: "Otro conductor tomó este viaje primero.",
  VIAJE_RESERVADO: "Este viaje está reservado unos minutos para el conductor que eligió el viajero.",
  PREFERIDO_INVALIDO: "Ese conductor no está disponible. Elige otro o pide a cualquiera.",
  LIMITE_CONTRAOFERTAS: "Ya se usaron todas las contraofertas de este viaje.",
  ESTADO_INVALIDO: "Esa acción ya no se puede hacer en este momento.",
  NO_ES_DUENO: "Este viaje no es tuyo.",
  SIN_UBICACION: "El conductor todavía no ha compartido su ubicación.",
  YA_COMPRO_ALGO: "Ya hay productos marcados como comprados: ya no se puede.",
  PEDIDO_CERRADO: "Este pedido ya está cerrado.",
  PEDIDO_NO_APROBADO: "Todavía no te aprueba el cliente: espera su confirmación.",
  PAGO_NO_CONFIRMADO: "Primero confirma que te llegó el pago por Zelle.",
};

export function textoDeError(e) {
  if (!e) return "Algo salió mal.";
  if (e.sinConexion) return "Sin conexión a internet. Revisa tu señal e intenta de nuevo.";
  return TEXTOS_MOTIVO[e.motivo] || TEXTOS_MOTIVO[e.codigo] || e.message || "Algo salió mal.";
}

async function llamar(metodo, ruta, cuerpo) {
  const sesion = leerSesion();
  const cabeceras = {};
  if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";
  if (sesion?.token) cabeceras.Authorization = `Bearer ${sesion.token}`;

  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ErrorApi("Sin conexión", { sinConexion: true });
  }

  let datos = {};
  try {
    datos = await respuesta.json();
  } catch {
    datos = {};
  }

  if (respuesta.status === 401 && sesion?.token && !ruta.startsWith("/api/auth/")) {
    alExpirar?.();
  }
  if (!respuesta.ok || datos.ok === false) {
    throw new ErrorApi(datos.error || `El servidor respondió ${respuesta.status}`, {
      estado: respuesta.status,
      codigo: datos.codigo,
      motivo: datos.motivo,
    });
  }
  return datos;
}

const get = (r) => llamar("GET", r);
const post = (r, c = {}) => llamar("POST", r, c);
const put = (r, c = {}) => llamar("PUT", r, c);
const borrar = (r) => llamar("DELETE", r);

export const api = {
  // cuenta
  login: (telefono, password) => post("/api/auth/login", { telefono, password }),
  registrar: (datos) => post("/api/usuarios/registro", datos),
  pedirCodigo: (telefono) => post("/api/verificacion/solicitar", { telefono }),
  confirmarCodigo: (telefono, codigo) => post("/api/verificacion/confirmar", { telefono, codigo }),
  modo: () => post("/api/usuarios/modo", { modo: "api" }),
  foto: (telefono) => get(`/api/usuarios/foto?telefono=${encodeURIComponent(telefono)}`),
  pushConfig: () => get("/api/push/config"),

  // catalogos
  categorias: () => get("/api/catalogo/categorias"),
  productosCatalogo: () => get("/api/catalogo/productos"),
  lugaresCatalogo: () => get("/api/catalogo/lugares"),

  // compras: cliente
  misPedidos: () => get("/api/pedidos"),
  crearPedido: (cuerpo) => post("/api/pedidos", cuerpo),
  pedido: (id) => get(`/api/pedidos/${id}`),
  compradoresEnServicio: (municipioId, categoriaId) =>
    get(`/api/transportistas/disponibles-conteo?municipioId=${municipioId}${categoriaId ? `&categoriaId=${categoriaId}` : ""}`),
  compradoresParaElegir: (municipioId) => get(`/api/compradores${municipioId ? `?municipioId=${municipioId}` : ""}`),
  aprobar: (id) => post(`/api/pedidos/${id}/aprobar`),
  rechazar: (id) => post(`/api/pedidos/${id}/rechazar`),
  abrirATodos: (id) => post(`/api/pedidos/${id}/abrir`),
  reabrir: (id) => post(`/api/pedidos/${id}/reabrir`),
  cancelar: (id) => post(`/api/pedidos/${id}/cancelar`),
  subirTope: (id, orden, nuevoTope) => post(`/api/pedidos/${id}/tope`, { orden, nuevoTope }),
  pagoCliente: (id, referencia) => post(`/api/pedidos/${id}/pago-cliente`, { referencia }),
  calificar: (id, calificacion, nota) => post(`/api/pedidos/${id}/calificar`, { calificacion, nota }),
  calificacionesComprador: (transportistaId) => get(`/api/transportistas/${transportistaId}/calificaciones`),

  // compras: comprador
  servicio: (enServicio, categoriasIds) => post("/api/transportista/servicio", { enServicio, categoriasIds }),
  disponibles: () => get("/api/pedidos/disponibles"),
  aceptar: (id) => post(`/api/pedidos/${id}/aceptar`),
  declinar: (id) => post(`/api/pedidos/${id}/declinar`),
  calificacionesCliente: (id) => get(`/api/pedidos/${id}/calificaciones-cliente`),
  abortar: (id) => post(`/api/pedidos/${id}/abortar`),
  marcarProductos: (id, actualizaciones) => post(`/api/pedidos/${id}/productos`, { actualizaciones }),
  pagoComprador: (id) => post(`/api/pedidos/${id}/pago-transportista`),
  cerrar: (id, exito) => post(`/api/pedidos/${id}/cerrar`, { exito }),

  // vitrina
  vitrinaMia: () => get("/api/vitrina/mia"),
  vitrinaCrear: (c) => post("/api/vitrina", c),
  vitrinaEditar: (id, c) => put(`/api/vitrina/${id}`, c),
  vitrinaBorrar: (id) => borrar(`/api/vitrina/${id}`),
  vitrinaSubida: () => post("/api/vitrina/subida"),
  vitrinaDe: (vendedorId) => get(`/api/vitrina/vendedor/${vendedorId}`),
  oportunidades: () => get("/api/vitrina/oportunidades"),
  avisosVitrina: () => get("/api/vitrina/avisos"),
  fijarAvisosVitrina: (activo) => put("/api/vitrina/avisos", { activo }),

  // viajes
  misViajes: () => get("/api/viajes"),
  crearViaje: (c) => post("/api/viajes", c),
  viaje: (id) => get(`/api/viajes/${id}`),
  viajesDisponibles: () => get("/api/viajes/disponibles"),
  conductoresParaElegir: (municipioId) => get(`/api/conductores${municipioId ? `?municipioId=${municipioId}` : ""}`),
  noPuedoViaje: (id) => post(`/api/viajes/${id}/no-puedo`),
  abrirViajeATodos: (id) => post(`/api/viajes/${id}/abrir`),
  aceptarViaje: (id) => post(`/api/viajes/${id}/aceptar`),
  contraofertar: (id, precioNuevo) => post(`/api/viajes/${id}/contraofertar`, { precioNuevo }),
  cancelarViaje: (id) => post(`/api/viajes/${id}/cancelar`),
  iniciarViaje: (id) => post(`/api/viajes/${id}/iniciar`),
  finalizarViaje: (id) => post(`/api/viajes/${id}/finalizar`),
  soltarViaje: (id) => post(`/api/viajes/${id}/soltar`),
  ubicacionConductor: (id) => get(`/api/viajes/${id}/ubicacion`),
  enviarUbicacion: (id, lat, lng) => post(`/api/viajes/${id}/ubicacion`, { lat, lng }),
  calificarViaje: (id, calificacion, nota) => post(`/api/viajes/${id}/calificar`, { calificacion, nota }),
  servicioViajes: (activar, tipoVehiculo) => post("/api/transportista/servicio-viajes", { activar, tipoVehiculo }),

  // soporte
  soporte: () => get("/api/soporte"),
  escribirSoporte: (texto, hiloId, asunto, diagnostico) => post("/api/soporte", { texto, hiloId, asunto, diagnostico }),
  soporteLeido: (hiloId) => post("/api/soporte/leido", { hiloId }),
};

/**
 * Sube una foto de la vitrina. Va a /fotos/subir del MISMO dominio (nginx la pasa al
 * servicio de fotos del VPS): asi el navegador no choca con permisos entre dominios.
 */
export async function subirFoto(blob) {
  const { permiso } = await api.vitrinaSubida();
  let r;
  try {
    r = await fetch("/fotos/subir", {
      method: "PUT",
      headers: { Authorization: `Bearer ${permiso}`, "Content-Type": "image/jpeg" },
      body: blob,
    });
  } catch {
    throw new ErrorApi("Sin conexión", { sinConexion: true });
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok || !datos.foto) throw new ErrorApi(datos.error || `El servidor de fotos respondió ${r.status}`);
  return datos.foto;
}
