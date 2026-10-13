import { useState } from "react";
import { Dialogo } from "../../componentes/piezas";
import { textoDeError } from "../../api";
import { monto } from "../../util";

export const ACTIVOS_VIAJE = ["buscando", "negociando", "aceptado", "en_curso"];

export const CHIP_VIAJE = {
  buscando: ["Buscando conductor", "ambar"],
  negociando: ["Negociando precio", "indigo"],
  aceptado: ["Confirmado", "menta"],
  en_curso: ["En curso", "menta"],
  finalizado: ["Terminado", "menta"],
  cancelado: ["Cancelado", "rojo"],
  abortado: ["Soltado", "gris"],
  no_publicada: ["Nadie lo tomó", "rojo"],
};

export function ruta(v) {
  const de = v.origen_municipio_etiqueta ? `${v.origen} (${v.origen_municipio_etiqueta})` : v.origen;
  const a = v.destino_municipio_etiqueta ? `${v.destino} (${v.destino_municipio_etiqueta})` : v.destino;
  return `${de} → ${a}`;
}

export function DialogoContraoferta({ precioActual, onEnviar, onCerrar }) {
  const [valor, setValor] = useState(String(precioActual || ""));
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <Dialogo titulo="Proponer otro precio" onCerrar={onCerrar}>
      <span className="sub">Precio actual: {monto(precioActual)} CUP. Entre los dos hay un límite de contraofertas.</span>
      <label className="campo">
        Tu precio (CUP)
        <input autoFocus inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value.replace(",", "."))} />
      </label>
      {error && <div className="error">{error}</div>}
      <button
        className="btn primario ancho"
        disabled={ocupado}
        onClick={async () => {
          const n = parseFloat(valor);
          if (!(n > 0)) return setError("Escribe un precio válido.");
          setOcupado(true);
          setError(null);
          try {
            await onEnviar(n);
            onCerrar();
          } catch (e) {
            setError(textoDeError(e));
          } finally {
            setOcupado(false);
          }
        }}
      >
        Enviar
      </button>
      <button className="btn texto" onClick={onCerrar}>Cancelar</button>
    </Dialogo>
  );
}
