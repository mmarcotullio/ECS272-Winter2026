import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

const el = document.getElementById("root");
if (!el) throw new Error('Missing <div id="root"></div> in index.html');

el.innerHTML = '<div style="padding:12px;font-family:system-ui">Booting…</div>';

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>
);
