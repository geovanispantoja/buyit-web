// Traduce un pedido tal como lo devuelve el backend a lo que se muestra.
export function estadoPedido(p) {
  switch (p?.estado) {
    case "Publicada":
      return p.retirado_en ? "vencido" : "buscando";
    case "Reclamada":
      return "reclamado";
    case "Aceptada":
      return "aceptado";
    case "Terminada":
      return "cerrado";
    case "Cancelada":
      return "cancelado";
    default:
      return "buscando";
  }
}

export const CHIP_CLIENTE = {
  buscando: ["Buscando comprador", "ambar"],
  reclamado: ["Aprueba", "indigo"],
  aceptado: ["En curso", "menta"],
  cerrado: ["Terminado", "menta"],
  cancelado: ["Cancelado", "rojo"],
  vencido: ["Pasó la hora", "rojo"],
};

export const FINALES = ["cerrado", "cancelado"];

/** Renglones del pedido con nombres simples. */
export function productosDe(p) {
  return [...(p?.detalle_pedido || [])]
    .sort((a, b) => a.orden - b.orden)
    .map((d) => ({
      orden: d.orden,
      nombre: d.catalogo_productos?.texto_original || d.nombre || `Producto ${d.orden}`,
      detalle: d.detalle_texto || "",
      lugar: d.catalogo_lugares?.texto_original || "",
      cantidad: Number(d.cantidad) || 0,
      tope: Number(d.precio_maximo) || 0,
      comprado: !!d.comprado,
      precioReal: d.precio_real != null ? Number(d.precio_real) : null,
      gpsLat: d.gps_lat,
      gpsLng: d.gps_lng,
    }));
}

export function topeTotal(productos) {
  return productos.reduce((s, x) => s + x.cantidad * x.tope, 0);
}

export function gastado(productos) {
  return productos.filter((x) => x.comprado).reduce((s, x) => s + x.cantidad * (x.precioReal || 0), 0);
}
