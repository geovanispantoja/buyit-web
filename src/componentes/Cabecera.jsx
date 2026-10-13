import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "./piezas";
import { useApp } from "../contexto";

export function alternarTema() {
  const raiz = document.documentElement;
  const oscuro = raiz.dataset.tema !== "oscuro";
  if (oscuro) raiz.dataset.tema = "oscuro";
  else delete raiz.dataset.tema;
  try {
    localStorage.setItem("buyit_tema", oscuro ? "oscuro" : "claro");
  } catch {
    /* nada */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", oscuro ? "#101219" : "#3B4C9B");
}

/** Cabecera de las pantallas principales: saludo, rol, modo, boton de tema y menu ⋮. */
export function Cabecera({ subtitulo, colorAvatar, opcionesExtra = [] }) {
  const { sesion, salir } = useApp();
  const navegar = useNavigate();
  const [menu, setMenu] = useState(false);
  const [, forzar] = useState(0);
  const oscuro = document.documentElement.dataset.tema === "oscuro";
  const opciones = [
    ...opcionesExtra,
    ["Soporte", () => navegar("/soporte")],
    ["Compartir la app", () => compartir()],
    ["Cerrar sesión", () => salir()],
  ];
  return (
    <header className="cabecera" style={{ position: "relative" }}>
      <span style={{ paddingTop: 4 }}>
        <Avatar nombre={sesion?.usuario?.nombre} tono={colorAvatar} />
      </span>
      <div className="cabecera-textos">
        <div className="cabecera-hola">Hola, {sesion?.usuario?.nombre}</div>
        {subtitulo && <div className="cabecera-sub">{subtitulo}</div>}
        <span className="pildora">
          <span className="punto" /> Internet
        </span>
      </div>
      <button
        className="boton-redondo"
        aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        onClick={() => {
          alternarTema();
          forzar((x) => x + 1);
        }}
      >
        {oscuro ? "☀" : "☾"}
      </button>
      <button className="boton-redondo" aria-label="Más opciones" onClick={() => setMenu((m) => !m)} style={{ fontWeight: 800 }}>
        ⋮
      </button>
      {menu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setMenu(false)} />
          <div className="menu" role="menu">
            {opciones.map(([texto, accion]) => (
              <button
                key={texto}
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  accion();
                }}
              >
                {texto}
              </button>
            ))}
          </div>
        </>
      )}
    </header>
  );
}

/** Barra simple con flecha atras (pantallas secundarias). */
export function BarraTitulo({ titulo, derecha, onVolver }) {
  const navegar = useNavigate();
  return (
    <div className="barra-titulo">
      <button className="boton-redondo" style={{ background: "transparent" }} aria-label="Volver" onClick={() => (onVolver ? onVolver() : navegar(-1))}>
        ‹
      </button>
      <h1>{titulo}</h1>
      {derecha}
    </div>
  );
}

export async function compartir() {
  const datos = { title: "Buy-iT", text: "Pide tus compras y viajes con Buy-iT", url: window.location.origin };
  try {
    if (navigator.share) await navigator.share(datos);
    else {
      await navigator.clipboard.writeText(datos.url);
      alert("Enlace copiado: " + datos.url);
    }
  } catch {
    /* el usuario cancelo */
  }
}
