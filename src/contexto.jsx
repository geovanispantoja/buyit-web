import { createContext, useContext } from "react";

export const ContextoApp = createContext(null);

/** { sesion, setSesion, salir, avisar(texto) } */
export function useApp() {
  return useContext(ContextoApp);
}
