import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./estilos.css";

if (document.documentElement.dataset.tema === "oscuro") {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#101219");
}

ReactDOM.createRoot(document.getElementById("raiz")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
