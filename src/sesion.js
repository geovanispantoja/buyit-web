// Sesion guardada en el navegador: token (JWT del backend) y datos del usuario.
// La verdad de pedidos/viajes vive en el servidor; aqui solo quien eres.
const CLAVE = "buyit_sesion";

export const ROLES = [
  { etiqueta: "Comprador cubano", tipo: "cliente", servicio: "compras", descripcion: "Pide su compra topando los precios y la espera en casa, con seguimiento de la compra." },
  { etiqueta: "Comprador extranjero", tipo: "cliente", servicio: "compras", descripcion: "Pide un pedido (víveres, ferretería, combo…) para su familiar en Cuba y lo paga por Zelle." },
  { etiqueta: "MiPyme", tipo: "transportista", servicio: "compras", descripcion: "Recibe pedidos de cubanos y extranjeros y gestiona el envío hasta la casa indicada." },
  { etiqueta: "Agente de compras", tipo: "transportista", servicio: "compras", descripcion: "Recibe pedidos y pone su capital y su transporte para comprar y entregar." },
  { etiqueta: "Viajero", tipo: "cliente", servicio: "viajes", descripcion: "Pide un tipo de vehículo para un viaje y negocia el precio con los conductores. Paga al llegar." },
  { etiqueta: "Transportista", tipo: "transportista", servicio: "viajes", descripcion: "Recibe pedidos de viaje con su vehículo. Cobra al llegar." },
];

export function rolPorEtiqueta(etiqueta) {
  return ROLES.find((r) => r.etiqueta === etiqueta) || null;
}

/** "compras" | "viajes" segun el rol; cuentas viejas sin rol: por tipo. */
export function servicioDe(usuario) {
  const rol = rolPorEtiqueta(usuario?.rolVisual);
  if (rol) return rol.servicio;
  return "compras";
}

export function leerSesion() {
  try {
    const texto = localStorage.getItem(CLAVE);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    /* modo privado: la sesion dura solo mientras la pagina este abierta */
  }
}

export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
}

// Pequeño almacen local para cosas que el servidor no devuelve (ej. "ya califique este pedido").
export function recordar(clave, valor) {
  try {
    localStorage.setItem("buyit_" + clave, JSON.stringify(valor));
  } catch {
    /* nada */
  }
}

export function recuerdo(clave, porDefecto = null) {
  try {
    const t = localStorage.getItem("buyit_" + clave);
    return t === null ? porDefecto : JSON.parse(t);
  } catch {
    return porDefecto;
  }
}
