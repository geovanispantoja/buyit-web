import { useState } from "react";
import { api, textoDeError } from "../api";
import { ROLES, rolPorEtiqueta } from "../sesion";
import { CampoMunicipio, Segmentado } from "../componentes/piezas";
import { useApp } from "../contexto";

const SIN_CODIGO = "Comprador extranjero"; // el SMS al extranjero sale caro: el backend no lo exige

function Telefono({ pais, setPais, numero, setNumero }) {
  return (
    <div className="fila arriba">
      <label className="campo" style={{ width: 96 }}>
        País
        <input inputMode="numeric" value={pais} onChange={(e) => setPais(e.target.value.replace(/\D/g, "").slice(0, 3))} />
      </label>
      <label className="campo crece">
        Tu teléfono
        <input inputMode="tel" autoComplete="tel-national" value={numero} onChange={(e) => setNumero(e.target.value.replace(/[^\d]/g, ""))} placeholder="5XXXXXXX" />
      </label>
    </div>
  );
}

function SelectorRol({ valor, onCambio }) {
  return (
    <div className="columna" style={{ gap: 8 }}>
      {ROLES.map((r) => (
        <button
          key={r.etiqueta}
          type="button"
          className={`tarjeta tocable ${valor === r.etiqueta ? "borde-indigo" : ""}`}
          style={{ textAlign: "left", padding: 12, gap: 4, border: valor === r.etiqueta ? undefined : "1.5px solid var(--linea)" }}
          onClick={() => onCambio(r.etiqueta)}
        >
          <span className="negrita">{r.etiqueta}</span>
          <span className="sub">{r.descripcion}</span>
        </button>
      ))}
    </div>
  );
}

/** Pide y confirma el codigo de 6 digitos que manda el PIVO por SMS. */
function Verificacion({ telefono, verificado, setVerificado }) {
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  if (verificado) return <div className="aviso-ok">✓ Teléfono verificado</div>;
  return (
    <div className="caja-suave">
      <span className="texto-chico">Te mandamos un código de 6 dígitos por SMS para comprobar que el número es tuyo.</span>
      {!enviado ? (
        <button
          className="btn secundario"
          disabled={ocupado || telefono.length < 8}
          onClick={async () => {
            setOcupado(true);
            setError(null);
            try {
              await api.pedirCodigo(telefono);
              setEnviado(true);
            } catch (e) {
              setError(textoDeError(e));
            } finally {
              setOcupado(false);
            }
          }}
        >
          {ocupado ? "Enviando…" : "Enviarme el código"}
        </button>
      ) : (
        <div className="fila">
          <input className="entrada crece" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Código" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
          <button
            className="btn primario"
            disabled={ocupado || codigo.length !== 6}
            onClick={async () => {
              setOcupado(true);
              setError(null);
              try {
                const r = await api.confirmarCodigo(telefono, codigo);
                if (r.ok) setVerificado(true);
              } catch (e) {
                const motivos = { INCORRECTO: "Código incorrecto.", EXPIRADO: "El código venció: pide otro.", MAX_INTENTOS: "Demasiados intentos: pide otro código.", SIN_SOLICITUD: "Pide primero el código." };
                setError(motivos[e.motivo] || textoDeError(e));
              } finally {
                setOcupado(false);
              }
            }}
          >
            Confirmar
          </button>
        </div>
      )}
      {enviado && (
        <button className="btn texto" onClick={() => { setEnviado(false); setCodigo(""); }}>
          No me llegó: pedir otro
        </button>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default function Entrar() {
  const { entrar } = useApp();
  const [modo, setModo] = useState("entrar"); // entrar | crear | olvide
  const [pais, setPais] = useState("53");
  const [numero, setNumero] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("Comprador cubano");
  const [municipios, setMunicipios] = useState([]);
  const [verificado, setVerificado] = useState(false);
  const [cambiarRol, setCambiarRol] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  const telefono = pais + numero;
  const datosRol = rolPorEtiqueta(rol);
  const recibe = datosRol?.tipo === "transportista";
  const pideCodigo = rol !== SIN_CODIGO;

  async function iniciar(tel, pass) {
    const r = await api.login(tel, pass);
    return entrar(r.token, r.usuario, pass);
  }

  async function onEntrar() {
    setOcupado(true);
    setError(null);
    try {
      if (cambiarRol) {
        // Mismo camino que la app: primero se entra (prueba la contraseña) y luego se cambia el rol.
        const r = await api.login(telefono, password);
        await api.registrar({
          telefono, tipo: datosRol.tipo, nombre: r.usuario.nombre, password: "",
          rolVisual: rol, municipios: recibe ? municipios : [],
        });
      }
      await iniciar(telefono, password);
    } catch (e) {
      setError(e.estado === 401 ? "Teléfono o contraseña incorrectos." : textoDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function onCrear() {
    if (!nombre.trim()) return setError("Escribe tu nombre.");
    if (password.length < 4) return setError("La contraseña debe tener al menos 4 caracteres.");
    if (recibe && municipios.length === 0) return setError("Elige al menos un municipio donde trabajas.");
    if (pideCodigo && !verificado) return setError("Primero verifica tu teléfono con el código.");
    setOcupado(true);
    setError(null);
    try {
      await api.registrar({
        telefono, tipo: datosRol.tipo, nombre: nombre.trim(), password,
        rolVisual: rol, municipios: recibe ? municipios : [],
      });
      await iniciar(telefono, password);
    } catch (e) {
      if (e.codigo === "CONTRASENA_ACTUAL_REQUERIDA")
        setError("Ese teléfono ya tiene cuenta. Entra con «Ya tengo cuenta» o usa «Olvidé mi contraseña».");
      else setError(textoDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function onRestablecer() {
    if (!verificado) return setError("Primero verifica tu teléfono con el código.");
    if (!nombre.trim()) return setError("Escribe tu nombre.");
    if (password.length < 4) return setError("La nueva contraseña debe tener al menos 4 caracteres.");
    setOcupado(true);
    setError(null);
    try {
      await api.registrar({ telefono, tipo: datosRol.tipo, nombre: nombre.trim(), password, rolVisual: rol, municipios: recibe ? municipios : [] });
      await iniciar(telefono, password);
    } catch (e) {
      setError(textoDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="app">
      <div className="contenido" style={{ paddingTop: "calc(32px + env(safe-area-inset-top))" }}>
        <div className="columna" style={{ alignItems: "center", gap: 8, marginBottom: 8 }}>
          {/* El logo ya lleva el nombre "BuyIT": no se repite como titulo. */}
          <img src="/iconos/icono-512.png" alt="Buy-iT" width="150" height="150" />
          <span className="gris">Tus compras y viajes, desde cualquier teléfono</span>
        </div>

        {modo !== "olvide" && (
          <Segmentado
            opciones={[["entrar", "Ya tengo cuenta"], ["crear", "Crear cuenta"]]}
            valor={modo}
            onCambio={(m) => { setModo(m); setError(null); }}
          />
        )}

        {modo === "entrar" && (
          <div className="tarjeta">
            <Telefono pais={pais} setPais={setPais} numero={numero} setNumero={setNumero} />
            <label className="campo">
              Contraseña
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="fila texto-chico" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={cambiarRol} onChange={(e) => setCambiarRol(e.target.checked)} />
              Quiero cambiar de rol o de zona al entrar
            </label>
            {cambiarRol && (
              <>
                <SelectorRol valor={rol} onCambio={setRol} />
                {recibe && <CampoMunicipio etiqueta="Municipios donde trabajas" valor={municipios} multiple onCambio={setMunicipios} />}
              </>
            )}
            {error && <div className="error">{error}</div>}
            <button className="btn primario ancho" disabled={ocupado || !numero || !password} onClick={onEntrar}>
              {ocupado ? "Un momento…" : "Entrar"}
            </button>
            <button className="btn texto" onClick={() => { setModo("olvide"); setError(null); setVerificado(false); setPassword(""); }}>
              Olvidé mi contraseña
            </button>
          </div>
        )}

        {modo === "crear" && (
          <div className="tarjeta">
            <label className="campo">
              Tu nombre
              <input autoComplete="given-name" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} />
            </label>
            <span className="seccion" style={{ padding: 0 }}>¿Qué eres?</span>
            <SelectorRol valor={rol} onCambio={setRol} />
            {recibe && <CampoMunicipio etiqueta="Municipios donde trabajas (puedes marcar varios)" valor={municipios} multiple onCambio={setMunicipios} />}
            <Telefono pais={pais} setPais={setPais} numero={numero} setNumero={(n) => { setNumero(n); setVerificado(false); }} />
            <label className="campo">
              Crea una contraseña
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <span className="ayuda">La vas a usar para entrar desde cualquier teléfono o computadora.</span>
            </label>
            {pideCodigo && <Verificacion telefono={telefono} verificado={verificado} setVerificado={setVerificado} />}
            {error && <div className="error">{error}</div>}
            <button className="btn primario ancho" disabled={ocupado} onClick={onCrear}>
              {ocupado ? "Creando tu cuenta…" : "Crear cuenta"}
            </button>
          </div>
        )}

        {modo === "olvide" && (
          <div className="tarjeta">
            <span className="titulo">Restablecer contraseña</span>
            <span className="sub">Verifica tu teléfono con un código por SMS y pon una contraseña nueva. Confirma también tu nombre y tu rol.</span>
            <Telefono pais={pais} setPais={setPais} numero={numero} setNumero={(n) => { setNumero(n); setVerificado(false); }} />
            <Verificacion telefono={telefono} verificado={verificado} setVerificado={setVerificado} />
            <label className="campo">
              Tu nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} />
            </label>
            <SelectorRol valor={rol} onCambio={setRol} />
            <label className="campo">
              Nueva contraseña
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn primario ancho" disabled={ocupado} onClick={onRestablecer}>
              {ocupado ? "Un momento…" : "Guardar y entrar"}
            </button>
            <button className="btn texto" onClick={() => { setModo("entrar"); setError(null); }}>Volver</button>
          </div>
        )}
        <p className="sub" style={{ textAlign: "center" }}>
          ¿Usas Android sin internet? Pide a tu agente la app de Buy-iT por SMS.
        </p>
      </div>
    </div>
  );
}
