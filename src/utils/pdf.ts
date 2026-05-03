import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import type { PDFFile } from "../types/pdf";

// pdf.js 在进行任何 PDF 操作前必须先设置 worker 路径
let workerInitialized = false;
export function initPDFWorker(workerUrl: string) {
  if (!workerInitialized) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    workerInitialized = true;
  }
}

class FileRangeTransport extends pdfjsLib.PDFDataRangeTransport {
  private file: File;

  constructor(file: File) {
    super(file.size, null);
    this.file = file;
  }

  requestDataRange(begin: number, end: number): void {
    this.file
      .slice(begin, end)
      .arrayBuffer()
      .then((buffer) => {
        this.onDataRange(begin, new Uint8Array(buffer));
      })
      .catch((err) => {
        console.error("Failed to read file range:", err);
      });
  }
}

function getDocumentFromFile(file: File): Promise<pdfjsLib.PDFDocumentProxy> {
  const transport = new FileRangeTransport(file);
  return pdfjsLib.getDocument({ range: transport }).promise;
}

export async function generateThumbnails(
  file: File,
): Promise<{ pageCount: number; thumbnails: (string | null)[] }> {
  const pdf = await getDocumentFromFile(file);
  const pageCount = pdf.numPages;

  const pagesToRender: number[] = [];
  if (pageCount === 1) pagesToRender.push(1);
  else if (pageCount === 2) pagesToRender.push(1, 2);
  else pagesToRender.push(1, pageCount);

  const thumbnails: (string | null)[] = new Array(pageCount).fill(null);
  for (const pageNum of pagesToRender) {
    const page = await pdf.getPage(pageNum);
    const scale = 0.3;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    thumbnails[pageNum - 1] = canvas.toDataURL("image/png");
  }

  pdf.destroy();
  return { pageCount, thumbnails };
}

export async function mergeTwoPDFs(
  source: PDFFile,
  target: PDFFile,
  pageIndex: number,
  side: "left" | "right",
): Promise<{
  file: File;
  pageNames: string[];
  thumbnails: (string | null)[];
  pageCount: number;
}> {
  const mergedPdf = await PDFDocument.create();

  const targetPdf = await PDFDocument.load(await target.file.arrayBuffer());
  const targetPages = await mergedPdf.copyPages(
    targetPdf,
    targetPdf.getPageIndices(),
  );

  const sourcePdf = await PDFDocument.load(await source.file.arrayBuffer());
  const sourcePages = await mergedPdf.copyPages(
    sourcePdf,
    sourcePdf.getPageIndices(),
  );

  const insertIndex =
    side === "left"
      ? Math.max(0, Math.min(pageIndex, targetPages.length))
      : Math.max(0, Math.min(pageIndex + 1, targetPages.length));

  const allPages = [...targetPages];
  allPages.splice(insertIndex, 0, ...sourcePages);

  for (const page of allPages) {
    mergedPdf.addPage(page);
  }

  const newPageNames = [
    ...target.pageNames.slice(0, insertIndex),
    ...source.pageNames,
    ...target.pageNames.slice(insertIndex),
  ];

  const newThumbnails = [
    ...target.thumbnails.slice(0, insertIndex),
    ...source.thumbnails,
    ...target.thumbnails.slice(insertIndex),
  ];

  const mergedBytes = await mergedPdf.save();
  const mergedFile = new File(
    [mergedBytes as unknown as BlobPart],
    target.file.name,
    {
      type: "application/pdf",
    },
  );

  return {
    file: mergedFile,
    pageNames: newPageNames,
    thumbnails: newThumbnails,
    pageCount: allPages.length,
  };
}
