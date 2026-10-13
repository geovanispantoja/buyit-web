import { useEffect, useState } from "react";
import { MUNICIPIOS } from "../datos/municipios";
import { api } from "../api";

export function Chip({ tono = "indigo", children }) {
  return <span className={`chip ${tono}`}>{children}</span>;
}

export function Avatar({ nombre, tono = "", tamano = "", foto }) {
  const inicial = String(nombre || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={`avatar ${tono} ${tamano}`} aria-hidden="true">
      {foto ? <img src={foto} alt="" /> : inicial}
    </span>
  );
}

/** Foto de perfil (la sube Geo desde el panel): si no hay, cae a la inicial. */
export function FotoPerfil({ telefono, nombre, tono = "suave", tamano = "chico" }) {
  const [foto, setFoto] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (telefono)
      api.foto(telefono).then((r) => vivo && setFoto(r.fotoPerfilUrl || null)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [telefono]);
  return <Avatar nombre={nombre} tono={tono} tamano={tamano} foto={foto} />;
}

export function Segmentado({ opciones, valor, onCambio }) {
  return (
    <div className="segmentado" role="tablist">
      {opciones.map(([v, texto]) => (
        <button key={v} role="tab" aria-selected={valor === v} className={valor === v ? "activo" : ""} onClick={() => onCambio(v)}>
          {texto}
        </button>
      ))}
    </div>
  );
}

export function Dialogo({ titulo, children, onCerrar }) {
  useEffect(() => {
    const tecla = (e) => e.key === "Escape" && onCerrar?.();
    document.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
    };
  }, [onCerrar]);
  return (
    <div className="velo" onClick={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div className="dialogo" role="dialog" aria-modal="true" aria-label={titulo}>
        {titulo && <h2>{titulo}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Estrellas({ valor, onCambio }) {
  return (
    <div className="estrellas" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={n <= valor ? "si" : ""} aria-label={`${n} estrella${n > 1 ? "s" : ""}`} onClick={() => onCambio(n)}>
          ★
        </button>
      ))}
    </div>
  );
}

/** Ventana para calificar (pedido o viaje). `notaObligatoria` como en la app. */
export function DialogoCalificar({ titulo, pregunta, notaObligatoria = true, onEnviar, onCerrar }) {
  const [estrellas, setEstrellas] = useState(5);
  const [nota, setNota] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async () => {
    if (notaObligatoria && !nota.trim()) return setError("Escribe una nota corta.");
    setEnviando(true);
    setError(null);
    try {
      await onEnviar(estrellas, nota.trim());
      onCerrar();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Dialogo titulo={titulo} onCerrar={onCerrar}>
      <p className="gris" style={{ margin: 0 }}>{pregunta}</p>
      <Estrellas valor={estrellas} onCambio={setEstrellas} />
      <label className="campo">
        {notaObligatoria ? "Nota (obligatoria)" : "Comentario (opcional)"}
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} />
      </label>
      {error && <div className="error">{error}</div>}
      <button className="btn primario ancho" disabled={enviando} onClick={enviar}>
        {enviando ? "Enviando…" : "Enviar"}
      </button>
      <button className="btn texto" onClick={onCerrar}>Ahora no</button>
    </Dialogo>
  );
}

export function Confirmar({ titulo, texto, si = "Sí", no = "No", peligro, onSi, onCerrar }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  return (
    <Dialogo titulo={titulo} onCerrar={onCerrar}>
      {texto && <p style={{ margin: 0 }}>{texto}</p>}
      {error && <div className="error">{error}</div>}
      <button
        className={`btn ancho ${peligro ? "peligro" : "primario"}`}
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          setError(null);
          try {
            await onSi();
            onCerrar();
          } catch (e) {
            setError(e.message);
          } finally {
            setOcupado(false);
          }
        }}
      >
        {ocupado ? "Un momento…" : si}
      </button>
      <button className="btn texto" onClick={onCerrar}>{no}</button>
    </Dialogo>
  );
}

const sinAcentos = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Buscador de los 168 municipios. `multiple` para los de interes de un comprador/conductor. */
export function BuscadorMunicipios({ titulo, seleccion, multiple = false, onCambio, onCerrar }) {
  const [texto, setTexto] = useState("");
  const elegidos = multiple ? seleccion || [] : seleccion ? [seleccion] : [];
  const q = sinAcentos(texto.trim());
  const lista = [...MUNICIPIOS]
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"))
    .filter((m) => !q || sinAcentos(m.etiqueta).includes(q) || sinAcentos(m.provincia).includes(q));
  return (
    <Dialogo titulo={titulo} onCerrar={onCerrar}>
      <input className="entrada" autoFocus placeholder="Busca tu municipio…" value={texto} onChange={(e) => setTexto(e.target.value)} />
      {multiple && elegidos.length > 0 && (
        <div className="fila envuelve">
          {elegidos.map((id) => (
            <button key={id} className="ficha activa" onClick={() => onCambio(elegidos.filter((x) => x !== id))}>
              {MUNICIPIOS.find((m) => m.id === id)?.etiqueta} ✕
            </button>
          ))}
        </div>
      )}
      <div className="lista-busqueda">
        {lista.map((m) => {
          const esta = elegidos.includes(m.id);
          return (
            <button
              key={m.id}
              className={esta ? "elegido" : ""}
              onClick={() => {
                if (multiple) onCambio(esta ? elegidos.filter((x) => x !== m.id) : [...elegidos, m.id]);
                else {
                  onCambio(m.id);
                  onCerrar();
                }
              }}
            >
              <span>{m.etiqueta}</span>
              <span className="sub">{esta ? "✓" : m.provincia}</span>
            </button>
          );
        })}
      </div>
      {multiple && (
        <button className="btn primario ancho" onClick={onCerrar}>
          Listo ({elegidos.length})
        </button>
      )}
    </Dialogo>
  );
}

/** Caja que se toca para elegir municipio(s). */
export function CampoMunicipio({ etiqueta, valor, multiple, onCambio }) {
  const [abierto, setAbierto] = useState(false);
  const ids = multiple ? valor || [] : valor ? [valor] : [];
  const texto = ids.map((id) => MUNICIPIOS.find((m) => m.id === id)?.etiqueta).filter(Boolean).join(", ");
  return (
    <>
      <button type="button" className="caja-valor" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => setAbierto(true)}>
        <span>{etiqueta}</span>
        <strong style={{ fontSize: 15 }}>{texto || "Elegir…"}</strong>
      </button>
      {abierto && (
        <BuscadorMunicipios titulo={etiqueta} seleccion={valor} multiple={multiple} onCambio={onCambio} onCerrar={() => setAbierto(false)} />
      )}
    </>
  );
}

/** Mensaje flotante que se quita solo. */
export function Cartel({ texto, onFin, ms = 4000 }) {
  useEffect(() => {
    if (!texto) return;
    const t = setTimeout(onFin, ms);
    return () => clearTimeout(t);
  }, [texto, onFin, ms]);
  if (!texto) return null;
  return (
    <div className="cartel" role="status" onClick={onFin}>
      {texto}
    </div>
  );
}
