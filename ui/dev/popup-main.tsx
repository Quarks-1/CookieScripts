import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { installChromeMock } from "./chrome-mock.ts";
import { DevToolbar } from "./DevToolbar.tsx";
import PopupApp from "../popup/App.tsx";
import "@shared/index.css";

installChromeMock();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="pb-28">
      <PopupApp />
      <DevToolbar surface="popup" />
    </div>
  </StrictMode>,
);
