import { useCallback, useEffect, useState } from "react";
import { recordar, recuerdo } from "../../sesion";

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

/**
 * "Borrar historial" (igual que la app): los pedidos terminados que el usuario quita se recuerdan
 * EN ESTE NAVEGADOR y no vuelven con el sondeo. Si uno revive (lo reabren, lo vuelve a tomar),
 * se deja de ocultar solo. No borra nada en el servidor.
 */
export function useOcultos(clave, idsActivos) {
  const [ocultos, setOcultos] = useState(() => new Set(recuerdo(clave, [])));
  const firmaActivos = idsActivos.join(",");
  useEffect(() => {
    const revividos = idsActivos.filter((id) => ocultos.has(id));
    if (revividos.length === 0) return;
    const nuevo = new Set(ocultos);
    revividos.forEach((id) => nuevo.delete(id));
    recordar(clave, [...nuevo]);
    setOcultos(nuevo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaActivos, clave]);
  const ocultar = useCallback(
    (ids) => {
      setOcultos((prev) => {
        const nuevo = new Set([...prev, ...ids]);
        recordar(clave, [...nuevo]);
        return nuevo;
      });
    },
    [clave]
  );
  return { ocultos, ocultar };
}

/**
 * Huella de los productos de un pedido tal como vienen en la lista que se refresca sola (cada 15 s).
 * Subir un tope o marcar un producto NO cambia la "version" del pedido, asi que el detalle se vuelve
 * a pedir cuando cambia esta huella (cantidad, tope, comprado, precio real), no solo la version.
 */
export function huellaProductos(p) {
  return JSON.stringify(
    [...(p?.detalle_pedido || [])]
      .sort((a, b) => a.orden - b.orden)
      .map((d) => [d.orden, d.cantidad, d.precio_maximo, d.comprado, d.precio_real])
  );
}
