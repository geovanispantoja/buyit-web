import { useEffect, useState } from "react";
import { api, subirFoto, textoDeError } from "../../api";
import { useApp } from "../../contexto";
import { BarraTitulo } from "../../componentes/Cabecera";
import { Confirmar, Dialogo } from "../../componentes/piezas";
import { monto, prepararFoto, useSondeo } from "../../util";

function EditorProducto({ producto, onGuardado, onCerrar }) {
  const [nombre, setNombre] = useState(producto?.nombre || "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion || "");
  const [precio, setPrecio] = useState(producto ? String(producto.precio_cup) : "");
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(producto?.foto_miniatura_url || null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  async function guardar() {
    if (!nombre.trim()) return setError("El nombre es obligatorio.");
    if (!(parseFloat(precio) > 0)) return setError("El precio tiene que ser mayor que cero.");
    setOcupado(true);
    setError(null);
    try {
      const cuerpo = { nombre: nombre.trim(), descripcion: descripcion.trim(), precio: parseFloat(precio) };
      if (archivo) {
        const blob = await prepararFoto(archivo);
        cuerpo.foto = await subirFoto(blob);
      } else if (quitarFoto) cuerpo.foto = null;
      if (producto) await api.vitrinaEditar(producto.id, cuerpo);
      else await api.vitrinaCrear(cuerpo);
      onGuardado();
      onCerrar();
    } catch (e) {
      setError(textoDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialogo titulo={producto ? "Editar producto" : "Nuevo producto"} onCerrar={onCerrar}>
      <label className="campo">
        Nombre
        <input value={nombre} maxLength={150} onChange={(e) => setNombre(e.target.value)} />
      </label>
      <label className="campo">
        Descripción (opcional)
        <textarea value={descripcion} maxLength={600} onChange={(e) => setDescripcion(e.target.value)} />
      </label>
      <label className="campo">
        Precio (CUP)
        <input inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value.replace(",", "."))} />
        <span className="ayuda">Es el precio tope con el que entra al pedido del cliente.</span>
      </label>
      <div className="fila">
        {vista && !quitarFoto ? <img className="foto-producto" src={vista} alt="" /> : <span className="foto-producto" />}
        <div className="columna crece">
          <label className="btn chico" style={{ alignSelf: "flex-start" }}>
            {vista && !quitarFoto ? "Cambiar foto" : "Poner foto"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setArchivo(f);
                setQuitarFoto(false);
                setVista(URL.createObjectURL(f));
              }}
            />
          </label>
          {vista && !quitarFoto && (
            <button className="btn texto" style={{ alignSelf: "flex-start", color: "var(--rojo)" }} onClick={() => { setQuitarFoto(true); setArchivo(null); }}>
              Quitar foto
            </button>
          )}
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn primario ancho" disabled={ocupado} onClick={guardar}>{ocupado ? "Guardando…" : "Guardar"}</button>
      <button className="btn texto" onClick={onCerrar}>Cancelar</button>
    </Dialogo>
  );
}

export default function MiVitrina() {
  const { avisar } = useApp();
  const vitrina = useSondeo(() => api.vitrinaMia(), 0);
  const opor = useSondeo(() => api.oportunidades(), 45000);
  const [avisos, setAvisos] = useState(null);
  const [editando, setEditando] = useState(null);
  const [borrando, setBorrando] = useState(null);

  useEffect(() => {
    api.avisosVitrina().then((r) => setAvisos(r.activo)).catch(() => {});
  }, []);

  const productos = vitrina.datos?.productos || [];
  const maximo = vitrina.datos?.maximo || 50;
  const oportunidades = opor.datos?.oportunidades || [];

  return (
    <div className="app">
      <BarraTitulo titulo="Mi vitrina" derecha={<span className="sub">{productos.length}/{maximo}</span>} />
      <div className="contenido">
        <span className="sub">Lo que publiques aquí lo ven los clientes que te eligen como su comprador de preferencia, y te avisamos cuando alguien pida algo parecido.</span>

        {avisos !== null && (
          <label className="tarjeta fila" style={{ flexDirection: "row", cursor: "pointer" }}>
            <span className="columna crece" style={{ gap: 0 }}>
              <span className="negrita">Avisarme de pedidos que coinciden</span>
              <span className="sub">Cuando alguien pide algo de tu vitrina</span>
            </span>
            <button
              className={`interruptor ${avisos ? "si" : ""}`}
              role="switch"
              aria-checked={avisos}
              onClick={async (e) => {
                e.preventDefault();
                try {
                  const r = await api.fijarAvisosVitrina(!avisos);
                  setAvisos(r.activo);
                } catch (err) {
                  avisar(textoDeError(err));
                }
              }}
            >
              <span />
            </button>
          </label>
        )}

        {oportunidades.length > 0 && (
          <section className="caja-ambar">
            <span className="negrita ambar">Te están pidiendo</span>
            {oportunidades.slice(0, 8).map((o) => (
              <span key={`${o.pedido_id}-${o.producto}`} className="texto-chico">• Pedido #{o.pedido_id}: «{o.producto}»</span>
            ))}
            <span className="sub">Ponte en servicio para verlos en «Pedidos disponibles».</span>
          </section>
        )}

        <button className="btn primario ancho" disabled={productos.length >= maximo} onClick={() => setEditando("nuevo")}>
          + Agregar producto
        </button>

        {vitrina.cargando && <div className="vacio">Cargando…</div>}
        {!vitrina.cargando && productos.length === 0 && <div className="vacio">Tu vitrina está vacía.</div>}
        {productos.map((p) => (
          <article key={p.id} className="tarjeta" style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {p.foto_miniatura_url ? <img className="foto-producto" src={p.foto_miniatura_url} alt="" loading="lazy" /> : <span className="foto-producto" />}
            <div className="columna crece">
              <span className="negrita">{p.nombre}</span>
              {p.descripcion && <span className="sub">{p.descripcion}</span>}
              <span className="negrita menta">{monto(p.precio_cup)} CUP</span>
              {p.visible === false && <span className="texto-chico rojo">Oculto por moderación</span>}
              <div className="fila">
                <button className="btn chico" onClick={() => setEditando(p)}>Editar</button>
                <button className="btn texto" style={{ color: "var(--rojo)" }} onClick={() => setBorrando(p)}>Borrar</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editando && (
        <EditorProducto
          producto={editando === "nuevo" ? null : editando}
          onGuardado={() => { avisar("Producto guardado."); vitrina.refrescar(); }}
          onCerrar={() => setEditando(null)}
        />
      )}
      {borrando && (
        <Confirmar
          titulo="¿Borrar este producto?"
          texto={`«${borrando.nombre}» se quita de tu vitrina.`}
          si="Sí, borrar"
          no="Cancelar"
          peligro
          onSi={async () => { await api.vitrinaBorrar(borrando.id); avisar("Producto borrado."); vitrina.refrescar(); }}
          onCerrar={() => setBorrando(null)}
        />
      )}
    </div>
  );
}
