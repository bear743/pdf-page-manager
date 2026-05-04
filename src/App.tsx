import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import DownloadSettings from "./components/DownloadSettings";
import UploadArea from "./components/UploadArea";
import LicenseActivate from "./components/LicenseActivate";
import { initPDFWorker } from "./utils/pdf";

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

function App() {
  const [activated, setActivated] = useState<boolean | null>(null);

  useEffect(() => {
    initPDFWorker(pdfWorkerUrl);
    checkActivation();
  }, []);

  const checkActivation = async () => {
    try {
      const isActivated = await invoke<boolean>("check_activated");
      setActivated(isActivated);
    } catch (e) {
      console.error("Failed to check activation:", e);
      setActivated(false);
    }
  };

  if (activated === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">检查激活状态...</div>
      </div>
    );
  }

  if (!activated) {
    return <LicenseActivate />;
  }

  return (
    <div className="h-screen flex flex-col bg-white select-none">
      <UploadArea />
      <DownloadSettings />
    </div>
  );
}

export default App;
