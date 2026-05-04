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

export async function generatePageThumbnail(
  file: File,
  pageIndex: number,
): Promise<string> {
  const pdf = await getDocumentFromFile(file);
  const page = await pdf.getPage(pageIndex + 1);
  const scale = 0.3;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/png");
  pdf.destroy();
  return dataUrl;
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
  originalPageNumbers: number[];
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

  const newOriginalPageNumbers = [
    ...target.originalPageNumbers.slice(0, insertIndex),
    ...source.originalPageNumbers,
    ...target.originalPageNumbers.slice(insertIndex),
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
    originalPageNumbers: newOriginalPageNumbers,
  };
}

export async function movePageToTarget(
  source: PDFFile,
  sourcePageIndex: number,
  target: PDFFile,
  targetPageIndex: number,
  side: "left" | "right",
): Promise<{
  sourceFile: File;
  sourcePageNames: string[];
  sourceThumbnails: (string | null)[];
  sourcePageCount: number;
  sourceOriginalPageNumbers: number[];
  targetFile: File;
  targetPageNames: string[];
  targetThumbnails: (string | null)[];
  targetPageCount: number;
  targetOriginalPageNumbers: number[];
}> {
  const sourcePdf = await PDFDocument.load(await source.file.arrayBuffer());
  const targetPdf = await PDFDocument.load(await target.file.arrayBuffer());

  // Create new source PDF (without the moved page)
  const newSourcePdf = await PDFDocument.create();
  const sourcePageIndices = sourcePdf.getPageIndices().filter((_, i) => i !== sourcePageIndex);
  const sourcePages = await newSourcePdf.copyPages(sourcePdf, sourcePageIndices);
  for (const page of sourcePages) {
    newSourcePdf.addPage(page);
  }

  // Create new target PDF (with the inserted page)
  const newTargetPdf = await PDFDocument.create();
  const targetPages = await newTargetPdf.copyPages(targetPdf, targetPdf.getPageIndices());
  const [movedPage] = await newTargetPdf.copyPages(sourcePdf, [sourcePageIndex]);

  const insertIndex =
    side === "left"
      ? Math.max(0, Math.min(targetPageIndex, targetPages.length))
      : Math.max(0, Math.min(targetPageIndex + 1, targetPages.length));

  targetPages.splice(insertIndex, 0, movedPage);
  for (const page of targetPages) {
    newTargetPdf.addPage(page);
  }

  const newSourcePageNames = source.pageNames.filter((_, i) => i !== sourcePageIndex);
  const newSourceOriginalPageNumbers = source.originalPageNumbers.filter((_, i) => i !== sourcePageIndex);
  const newSourceThumbnails = source.thumbnails.filter((_, i) => i !== sourcePageIndex);

  const newTargetPageNames = [
    ...target.pageNames.slice(0, insertIndex),
    source.pageNames[sourcePageIndex],
    ...target.pageNames.slice(insertIndex),
  ];
  const newTargetOriginalPageNumbers = [
    ...target.originalPageNumbers.slice(0, insertIndex),
    source.originalPageNumbers[sourcePageIndex],
    ...target.originalPageNumbers.slice(insertIndex),
  ];
  const newTargetThumbnails = [
    ...target.thumbnails.slice(0, insertIndex),
    source.thumbnails[sourcePageIndex],
    ...target.thumbnails.slice(insertIndex),
  ];

  const sourceBytes = await newSourcePdf.save();
  const sourceFile = new File([sourceBytes as unknown as BlobPart], source.file.name, { type: "application/pdf" });

  const targetBytes = await newTargetPdf.save();
  const targetFile = new File([targetBytes as unknown as BlobPart], target.file.name, { type: "application/pdf" });

  return {
    sourceFile,
    sourcePageNames: newSourcePageNames,
    sourceThumbnails: newSourceThumbnails,
    sourcePageCount: newSourcePageNames.length,
    sourceOriginalPageNumbers: newSourceOriginalPageNumbers,
    targetFile,
    targetPageNames: newTargetPageNames,
    targetThumbnails: newTargetThumbnails,
    targetPageCount: newTargetPageNames.length,
    targetOriginalPageNumbers: newTargetOriginalPageNumbers,
  };
}

export async function reorderPdfPages(
  file: PDFFile,
  fromIndex: number,
  toIndex: number,
): Promise<{ file: File; pageNames: string[]; originalPageNumbers: number[]; thumbnails: (string | null)[] }> {
  const pdfDoc = await PDFDocument.load(await file.file.arrayBuffer());
  const pageCount = pdfDoc.getPageCount();

  // Build new page order
  const newOrder: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    if (i === fromIndex) continue; // skip the moved page
    newOrder.push(i);
  }
  newOrder.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, fromIndex);

  // Create new PDF with reordered pages
  const newPdfDoc = await PDFDocument.create();
  const pages = await newPdfDoc.copyPages(pdfDoc, newOrder);
  for (const page of pages) {
    newPdfDoc.addPage(page);
  }

  // Reorder metadata
  const newPageNames = [...file.pageNames];
  const newOriginalPageNumbers = [...file.originalPageNumbers];
  const newThumbnails = [...file.thumbnails];

  const [removedName] = newPageNames.splice(fromIndex, 1);
  const [removedOrig] = newOriginalPageNumbers.splice(fromIndex, 1);
  const [removedThumb] = newThumbnails.splice(fromIndex, 1);

  const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex;
  newPageNames.splice(adjustedTo, 0, removedName);
  newOriginalPageNumbers.splice(adjustedTo, 0, removedOrig);
  newThumbnails.splice(adjustedTo, 0, removedThumb);

  const bytes = await newPdfDoc.save();
  const newFile = new File([bytes as unknown as BlobPart], file.file.name, { type: "application/pdf" });

  return {
    file: newFile,
    pageNames: newPageNames,
    originalPageNumbers: newOriginalPageNumbers,
    thumbnails: newThumbnails,
  };
}

export async function deletePdfPage(
  file: PDFFile,
  pageIndex: number,
): Promise<{ file: File; pageNames: string[]; originalPageNumbers: number[]; thumbnails: (string | null)[] }> {
  const pdfDoc = await PDFDocument.load(await file.file.arrayBuffer());

  const newPdfDoc = await PDFDocument.create();
  const indices = pdfDoc.getPageIndices().filter((_, i) => i !== pageIndex);
  const pages = await newPdfDoc.copyPages(pdfDoc, indices);
  for (const page of pages) {
    newPdfDoc.addPage(page);
  }

  const newPageNames = file.pageNames.filter((_, i) => i !== pageIndex);
  const newOriginalPageNumbers = file.originalPageNumbers.filter((_, i) => i !== pageIndex);
  const newThumbnails = file.thumbnails.filter((_, i) => i !== pageIndex);

  const bytes = await newPdfDoc.save();
  const newFile = new File([bytes as unknown as BlobPart], file.file.name, { type: "application/pdf" });

  return {
    file: newFile,
    pageNames: newPageNames,
    originalPageNumbers: newOriginalPageNumbers,
    thumbnails: newThumbnails,
  };
}

export async function deletePdfPages(
  file: PDFFile,
  pageIndices: number[],
): Promise<{ file: File; pageNames: string[]; originalPageNumbers: number[]; thumbnails: (string | null)[] }> {
  const pdfDoc = await PDFDocument.load(await file.file.arrayBuffer());

  const deleteSet = new Set(pageIndices);
  const indices = pdfDoc.getPageIndices().filter((_, i) => !deleteSet.has(i));
  const newPdfDoc = await PDFDocument.create();
  const pages = await newPdfDoc.copyPages(pdfDoc, indices);
  for (const page of pages) {
    newPdfDoc.addPage(page);
  }

  const newPageNames = file.pageNames.filter((_, i) => !deleteSet.has(i));
  const newOriginalPageNumbers = file.originalPageNumbers.filter((_, i) => !deleteSet.has(i));
  const newThumbnails = file.thumbnails.filter((_, i) => !deleteSet.has(i));

  const bytes = await newPdfDoc.save();
  const newFile = new File([bytes as unknown as BlobPart], file.file.name, { type: "application/pdf" });

  return {
    file: newFile,
    pageNames: newPageNames,
    originalPageNumbers: newOriginalPageNumbers,
    thumbnails: newThumbnails,
  };
}
