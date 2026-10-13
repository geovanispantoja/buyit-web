import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ContextoApp } from "./contexto";
import { api, cuandoExpireSesion } from "./api";
import { borrarSesion, guardarSesion, leerSesion, servicioDe } from "./sesion";
import { conectarAvisos, desconectarAvisos } from "./vivo";
import { Cartel } from "./componentes/piezas";
import Entrar from "./pantallas/Entrar";
import Soporte from "./pantallas/Soporte";
import MisPedidos from "./pantallas/compras/MisPedidos";
import NuevoPedido from "./pantallas/compras/NuevoPedido";
import DetallePedido from "./pantallas/compras/DetallePedido";
import PanelComprador from "./pantallas/compras/PanelComprador";
import MiVitrina from "./pantallas/compras/MiVitrina";
import PanelViajero from "./pantallas/viajes/PanelViajero";
import NuevoViaje from "./pantallas/viajes/NuevoViaje";
import PanelConductor from "./pantallas/viajes/PanelConductor";

export default function App() {
  const [sesion, setSesion] = useState(leerSesion);
  const [cartel, setCartel] = useState(null);
  const navegar = useNavigate();

  const salir = useCallback(async () => {
    const s = leerSesion();
    // Igual que la app: al cerrar sesion se sale de servicio, para no quedar "en servicio" fantasma.
    if (s?.usuario?.tipo === "transportista") {
      if (servicioDe(s.usuario) === "viajes") await api.servicioViajes(false).catch(() => {});
      else await api.servicio(false).catch(() => {});
    }
    desconectarAvisos();
    borrarSesion();
    setSesion(null);
    navegar("/", { replace: true });
  }, [navegar]);

  const entrar = useCallback(async (token, usuario, _password) => {
    const nueva = { token, usuario };
    guardarSesion(nueva);
    setSesion(nueva);
    // Esta cuenta ahora se usa por internet: que el backend no le mande SMS de aviso.
    await api.modo().catch(() => {});
    navegar("/", { replace: true });
  }, [navegar]);

  const avisar = useCallback((texto) => setCartel(texto), []);
  const cerrarCartel = useCallback(() => setCartel(null), []);

  useEffect(() => {
    cuandoExpireSesion(() => {
      borrarSesion();
      setSesion(null);
      setCartel("Tu sesión venció. Entra de nuevo.");
    });
  }, []);

  useEffect(() => {
    if (!sesion?.token) return;
    conectarAvisos();
    const alAviso = (e) => setCartel(e.detail);
    window.addEventListener("buyit:aviso", alAviso);
    return () => {
      window.removeEventListener("buyit:aviso", alAviso);
      desconectarAvisos();
    };
  }, [sesion?.token]);

  const contexto = { sesion, setSesion, salir, entrar, avisar };
  const esComprador = sesion?.usuario?.tipo === "transportista";
  const servicio = sesion ? servicioDe(sesion.usuario) : null;

  return (
    <ContextoApp.Provider value={contexto}>
      {!sesion ? (
        <Entrar />
      ) : (
        <Routes>
          <Route path="/" element={<Navigate to={servicio === "viajes" ? "/viajes" : "/compras"} replace />} />
          <Route path="/compras" element={esComprador ? <PanelComprador /> : <MisPedidos />} />
          <Route path="/compras/nuevo" element={<NuevoPedido />} />
          <Route path="/compras/pedido/:id" element={<DetallePedido />} />
          <Route path="/compras/vitrina" element={<MiVitrina />} />
          <Route path="/viajes" element={esComprador ? <PanelConductor /> : <PanelViajero />} />
          <Route path="/viajes/nuevo" element={<NuevoViaje />} />
          <Route path="/soporte" element={<Soporte />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
      <Cartel texto={cartel} onFin={cerrarCartel} />
    </ContextoApp.Provider>
  );
}
