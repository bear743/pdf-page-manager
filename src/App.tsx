import { useEffect } from "react";
import DownloadSettings from "./components/DownloadSettings";
import UploadArea from "./components/UploadArea";
import { initPDFWorker } from "./utils/pdf";

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

function App() {
  useEffect(() => {
    initPDFWorker(pdfWorkerUrl);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-white select-none">
      <UploadArea />
      <DownloadSettings />
    </div>
  );
}

export default App;
