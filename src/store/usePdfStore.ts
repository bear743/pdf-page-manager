import { create } from "zustand";
import { PDFDocument } from "pdf-lib";
import type { PDFFile } from "../types/pdf";
import { generateThumbnails, mergeTwoPDFs, movePageToTarget, reorderPdfPages, deletePdfPage, deletePdfPages } from "../utils/pdf";

interface PdfStore {
  files: PDFFile[];
  customRange: string;
  fixedSplitSize: number;

  setCustomRange: (value: string) => void;
  setFixedSplitSize: (value: number) => void;

  addFiles: (fileList: FileList | null) => Promise<void>;
  removeFile: (id: string) => void;
  reorderFiles: (files: PDFFile[]) => void;
  reorderPages: (fileId: string, fromIndex: number, toIndex: number) => void;
  deletePage: (fileId: string, pageIndex: number) => void;
  deletePages: (fileId: string, pageIndices: number[]) => void;
  movePage: (
    sourceId: string,
    sourcePageIndex: number,
    targetId: string,
    targetPageIndex: number,
    side: "left" | "right",
  ) => Promise<void>;
  mergeFiles: (
    sourceId: string,
    targetId: string,
    pageIndex: number,
    side: "left" | "right",
  ) => Promise<void>;
  mergeAllFiles: () => Promise<void>;
  splitByCustomRange: () => Promise<void>;
  splitByFixedPages: () => Promise<void>;
  downloadAllFiles: () => void;
}

function computeCustomRange(files: PDFFile[]): string {
  const loadedFiles = files.filter((f) => f.pageCount > 0);
  if (loadedFiles.length === 0) return "";

  let start = 1;
  const ranges: string[] = [];
  for (const file of loadedFiles) {
    ranges.push(`${start}-${start + file.pageCount - 1}`);
    start += file.pageCount;
  }
  return ranges.join(",");
}

function parseRange(rangeStr: string): { start: number; end: number }[] | null {
  const parts = rangeStr.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const ranges: { start: number; end: number }[] = [];
  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = Number(startStr);
      const end = Number(endStr);
      if (isNaN(start) || isNaN(end) || start < 1 || end < start) return null;
      ranges.push({ start, end });
    } else {
      const num = Number(part);
      if (isNaN(num) || num < 1) return null;
      ranges.push({ start: num, end: num });
    }
  }

  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start !== ranges[i - 1].end + 1) return null;
  }

  return ranges;
}

async function splitByRanges(
  files: PDFFile[],
  ranges: { start: number; end: number }[],
): Promise<{ file: File; pageNames: string[]; originalPageNumbers: number[] }[]> {
  const results: { file: File; pageNames: string[]; originalPageNumbers: number[] }[] = [];
  let nextRangeIdx = 0;
  let outputDoc = await PDFDocument.create();
  let outputPageNames: string[] = [];
  let outputOriginalPageNumbers: number[] = [];
  let outputSourceName = "split.pdf";

  let currentGlobal = 1;
  for (const pdfFile of files) {
    const fileStart = currentGlobal;
    const fileEnd = currentGlobal + pdfFile.pageCount - 1;

    const needsLoad = ranges.some(
      (r) => Math.max(r.start, fileStart) <= Math.min(r.end, fileEnd),
    );
    if (!needsLoad) {
      currentGlobal = fileEnd + 1;
      continue;
    }

    const pdf = await PDFDocument.load(await pdfFile.file.arrayBuffer());

    for (let i = nextRangeIdx; i < ranges.length; i++) {
      const intersectStart = Math.max(ranges[i].start, fileStart);
      const intersectEnd = Math.min(ranges[i].end, fileEnd);

      if (intersectStart > intersectEnd) break;

      if (outputSourceName === "split.pdf") {
        outputSourceName = pdfFile.file.name;
      }

      const localStart = intersectStart - fileStart;
      const localEnd = intersectEnd - fileStart;
      const indices = Array.from(
        { length: localEnd - localStart + 1 },
        (_, i) => localStart + i,
      );
      const pages = await outputDoc.copyPages(pdf, indices);
      for (const page of pages) {
        outputDoc.addPage(page);
      }
      outputPageNames.push(
        ...pdfFile.pageNames.slice(localStart, localEnd + 1),
      );
      outputOriginalPageNumbers.push(
        ...pdfFile.originalPageNumbers.slice(localStart, localEnd + 1),
      );

      if (ranges[i].end <= fileEnd) {
        const bytes = await outputDoc.save();
        results.push({
          file: new File(
            [bytes as unknown as BlobPart],
            outputSourceName,
            { type: "application/pdf" },
          ),
          pageNames: outputPageNames,
          originalPageNumbers: outputOriginalPageNumbers,
        });
        outputDoc = await PDFDocument.create();
        outputPageNames = [];
        outputOriginalPageNumbers = [];
        outputSourceName = "split.pdf";
        nextRangeIdx = i + 1;
      }
    }

    currentGlobal = fileEnd + 1;
  }

  return results;
}

export const usePdfStore = create<PdfStore>((set, get) => ({
  files: [],
  customRange: "",
  fixedSplitSize: 1,

  setCustomRange: (customRange) => set({ customRange }),
  setFixedSplitSize: (fixedSplitSize) => set({ fixedSplitSize }),

  addFiles: async (fileList) => {
    if (!fileList) return;
    const allFiles = Array.from(fileList);
    const pdfFiles = allFiles.filter((f) => f.type === "application/pdf");
    const nonPdfFiles = allFiles.filter((f) => f.type !== "application/pdf");

    if (nonPdfFiles.length > 0) {
      const names = nonPdfFiles.map((f) => f.name).join(", ");
      alert(`以下文件不是PDF格式，已跳过：${names}`);
    }

    for (const file of pdfFiles) {
      const id = Math.random().toString(36).slice(2);

      set((state) => ({
        files: [
          ...state.files,
          {
            id,
            file,
            pageCount: 0,
            thumbnails: [],
            pageNames: [file.name],
            originalPageNumbers: [],
            isLoading: true,
          },
        ],
      }));

      const { pageCount, thumbnails } = await generateThumbnails(file);

      set((state) => ({
        files: state.files.map((f) =>
          f.id === id
            ? {
                ...f,
                pageCount,
                thumbnails,
                pageNames: Array(pageCount).fill(file.name),
                originalPageNumbers: Array.from({ length: pageCount }, (_, i) => i + 1),
                isLoading: false,
              }
            : f,
        ),
      }));
    }
  },

  reorderFiles: (files) => set({ files }),
  reorderPages: async (fileId: string, fromIndex: number, toIndex: number) => {
    const { files } = get();
    const pdfFile = files.find((f) => f.id === fileId);
    if (!pdfFile) return;

    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, isReordering: true } : f,
      ),
    }));

    try {
      const result = await reorderPdfPages(pdfFile, fromIndex, toIndex);
      set((state) => ({
        files: state.files.map((f) =>
          f.id === fileId
            ? { ...f, file: result.file, thumbnails: result.thumbnails, pageNames: result.pageNames, originalPageNumbers: result.originalPageNumbers, isReordering: false }
            : f,
        ),
      }));
    } catch (err) {
      console.error("Reorder pages failed:", err);
      set((state) => ({
        files: state.files.map((f) =>
          f.id === fileId ? { ...f, isReordering: false } : f,
        ),
      }));
    }
  },

  deletePage: async (fileId: string, pageIndex: number) => {
    const { files } = get();
    const pdfFile = files.find((f) => f.id === fileId);
    if (!pdfFile) return;

    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, isDeleting: true } : f,
      ),
    }));

    try {
      const result = await deletePdfPage(pdfFile, pageIndex);
      set((state) => ({
        files: state.files.map((f) =>
          f.id === fileId
            ? { ...f, file: result.file, thumbnails: result.thumbnails, pageNames: result.pageNames, originalPageNumbers: result.originalPageNumbers, pageCount: result.pageNames.length, isDeleting: false }
            : f,
        ),
      }));
    } catch (err) {
      console.error("Delete page failed:", err);
      set((state) => ({
        files: state.files.map((f) =>
          f.id === fileId ? { ...f, isDeleting: false } : f,
        ),
      }));
    }
  },

  deletePages: async (fileId: string, pageIndices: number[]) => {
    const { files } = get();
    const pdfFile = files.find((f) => f.id === fileId);
    if (!pdfFile || pageIndices.length === 0) return;

    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, isDeleting: true } : f,
      ),
    }));

    try {
      const result = await deletePdfPages(pdfFile, pageIndices);
      set((state) => ({
        files: state.files.map((f) =>
          f.id === fileId
            ? { ...f, file: result.file, thumbnails: result.thumbnails, pageNames: result.pageNames, originalPageNumbers: result.originalPageNumbers, pageCount: result.pageNames.length, isDeleting: false }
            : f,
        ),
      }));
    } catch (err) {
      console.error("Delete pages failed:", err);
      set((state) => ({
        files: state.files.map((f) =>
          f.id === fileId ? { ...f, isDeleting: false } : f,
        ),
      }));
    }
  },

  movePage: async (sourceId, sourcePageIndex, targetId, targetPageIndex, side) => {
    const { files } = get();
    const sourcePdf = files.find((f) => f.id === sourceId);
    const targetPdf = files.find((f) => f.id === targetId);
    if (!sourcePdf || !targetPdf) return;

    set((s) => ({
      files: s.files.map((f) =>
        f.id === sourceId || f.id === targetId ? { ...f, isMerging: true } : f,
      ),
    }));

    try {
      const result = await movePageToTarget(sourcePdf, sourcePageIndex, targetPdf, targetPageIndex, side);

      set((s) => ({
        files: s.files.map((f) => {
          if (f.id === sourceId) {
            return {
              ...f,
              file: result.sourceFile,
              pageCount: result.sourcePageCount,
              thumbnails: result.sourceThumbnails,
              pageNames: result.sourcePageNames,
              originalPageNumbers: result.sourceOriginalPageNumbers,
              isMerging: false,
            };
          }
          if (f.id === targetId) {
            return {
              ...f,
              file: result.targetFile,
              pageCount: result.targetPageCount,
              thumbnails: result.targetThumbnails,
              pageNames: result.targetPageNames,
              originalPageNumbers: result.targetOriginalPageNumbers,
              isMerging: false,
            };
          }
          return f;
        }),
      }));
    } catch (err) {
      console.error("Move page failed:", err);
      alert("页面移动失败，请检查文件是否有效");
      set((s) => ({
        files: s.files.map((f) =>
          f.id === sourceId || f.id === targetId ? { ...f, isMerging: false } : f,
        ),
      }));
    }
  },

  removeFile: (id) => set((state) => ({ files: state.files.filter((f) => f.id !== id) })),

  mergeFiles: async (sourceId, targetId, pageIndex, side) => {
    const { files } = get();
    const sourcePdf = files.find((f) => f.id === sourceId);
    const targetPdf = files.find((f) => f.id === targetId);
    if (!sourcePdf || !targetPdf) return;

    set((s) => ({
      files: s.files.map((f) =>
        f.id === sourceId || f.id === targetId ? { ...f, isMerging: true } : f,
      ),
    }));

    try {
      const { file: mergedFile, pageNames, thumbnails, pageCount, originalPageNumbers } =
        await mergeTwoPDFs(sourcePdf, targetPdf, pageIndex, side);

      set((s) => ({
        files: s.files
          .filter((f) => f.id !== sourceId)
          .map((f) =>
            f.id === targetId
              ? {
                  ...f,
                  file: mergedFile,
                  pageCount,
                  thumbnails,
                  pageNames,
                  originalPageNumbers,
                  isLoading: false,
                  isMerging: false,
                }
              : f,
          ),
      }));
    } catch (err) {
      set((s) => ({
        files: s.files.map((f) =>
          f.id === sourceId || f.id === targetId
            ? { ...f, isMerging: false }
            : f,
        ),
      }));
      console.error("PDF merge failed:", err);
      alert("PDF 合并失败，请检查文件是否有效");
    }
  },

  mergeAllFiles: async () => {
    const { files } = get();
    const loadedFiles = files.filter((f) => f.pageCount > 0 && !f.isLoading);
    if (loadedFiles.length === 0) return;
    if (loadedFiles.length === 1) return;

    set((s) => ({
      files: s.files.map((f) => ({ ...f, isLoading: true })),
    }));

    try {
      const mergedPdf = await PDFDocument.create();
      let outputPageNames: string[] = [];
      let outputThumbnails: (string | null)[] = [];
      let outputOriginalPageNumbers: number[] = [];
      let outputSourceName = loadedFiles[0].file.name;

      for (const pdfFile of loadedFiles) {
        const pdf = await PDFDocument.load(await pdfFile.file.arrayBuffer());
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        for (const page of pages) {
          mergedPdf.addPage(page);
        }
        outputPageNames.push(...pdfFile.pageNames);
        outputThumbnails.push(...pdfFile.thumbnails);
        outputOriginalPageNumbers.push(...pdfFile.originalPageNumbers);
      }

      const bytes = await mergedPdf.save();
      const mergedFile = new File(
        [bytes as unknown as BlobPart],
        outputSourceName,
        { type: "application/pdf" },
      );

      set({
        files: [
          {
            id: Math.random().toString(36).slice(2),
            file: mergedFile,
            pageCount: outputPageNames.length,
            thumbnails: outputThumbnails,
            pageNames: outputPageNames,
            originalPageNumbers: outputOriginalPageNumbers,
            isLoading: false,
          },
        ],
      });
    } catch (err) {
      console.error("Merge all failed:", err);
      alert("合并全部失败，请检查文件是否有效");
      set((s) => ({
        files: s.files.map((f) => ({ ...f, isLoading: false })),
      }));
    }
  },

  splitByCustomRange: async () => {
    const { files, customRange } = get();

    const loadedFiles = files.filter((f) => f.pageCount > 0 && !f.isLoading);
    if (loadedFiles.length === 0) return;

    const totalPages = loadedFiles.reduce((sum, f) => sum + f.pageCount, 0);
    const ranges = parseRange(customRange);

    if (!ranges) {
      alert("范围格式错误，请使用格式如：1-10,11-15,16-20");
      return;
    }

    const lastRange = ranges[ranges.length - 1];
    if (lastRange.end !== totalPages) {
      alert(`范围总页数 (${lastRange.end}) 与文件总页数 (${totalPages}) 不匹配`);
      return;
    }

    let checkGlobal = 1;
    let unchanged = true;
    for (let i = 0; i < loadedFiles.length; i++) {
      const expectedStart = checkGlobal;
      const expectedEnd = checkGlobal + loadedFiles[i].pageCount - 1;
      const range = ranges[i];
      if (!range || range.start !== expectedStart || range.end !== expectedEnd) {
        unchanged = false;
        break;
      }
      checkGlobal = expectedEnd + 1;
    }
    if (unchanged && ranges.length === loadedFiles.length) return;

    set((s) => ({
      files: s.files.map((f) => ({ ...f, isSplitting: true })),
    }));

    try {
      const splitResults = await splitByRanges(loadedFiles, ranges);
      const newFiles: PDFFile[] = [];
      for (const { file: newFile, pageNames, originalPageNumbers } of splitResults) {
        const { pageCount, thumbnails } = await generateThumbnails(newFile);

        newFiles.push({
          id: Math.random().toString(36).slice(2),
          file: newFile,
          pageCount,
          thumbnails,
          pageNames,
          originalPageNumbers,
          isLoading: false,
        });
      }

      set({ files: newFiles });
    } catch (err) {
      console.error("Custom range split failed:", err);
      alert("自定义范围拆分失败，请检查文件是否有效");
      set((s) => ({
        files: s.files.map((f) => ({ ...f, isSplitting: false })),
      }));
    }
  },

  downloadAllFiles: () => {
    const { files } = get();
    const loadedFiles = files.filter((f) => f.pageCount > 0 && !f.isLoading && !f.isMerging);
    if (loadedFiles.length === 0) {
      alert("没有可下载的文件");
      return;
    }

    for (let i = 0; i < loadedFiles.length; i++) {
      const pdfFile = loadedFiles[i];
      const url = URL.createObjectURL(pdfFile.file);
      const a = document.createElement("a");
      a.href = url;
      const ext = pdfFile.file.name.split(".").pop() || "pdf";
      a.download = `${i + 1}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  },

  splitByFixedPages: async () => {
    const { files, fixedSplitSize } = get();
    const loadedFiles = files.filter((f) => f.pageCount > 0 && !f.isLoading);
    if (loadedFiles.length === 0) return;

    if (fixedSplitSize < 1) {
      alert("固定页数必须大于0");
      return;
    }

    set((s) => ({
      files: s.files.map((f) => ({ ...f, isSplitting: true })),
    }));

    try {
      const results: { file: File; pageNames: string[]; originalPageNumbers: number[] }[] = [];
      let outputDoc = await PDFDocument.create();
      let outputPageNames: string[] = [];
      let outputOriginalPageNumbers: number[] = [];
      let pageCounter = 0;

      for (const pdfFile of loadedFiles) {
        const pdf = await PDFDocument.load(await pdfFile.file.arrayBuffer());
        const totalPages = pdf.getPageCount();

        for (let i = 0; i < totalPages; i++) {
          const [page] = await outputDoc.copyPages(pdf, [i]);
          outputDoc.addPage(page);
          outputPageNames.push(pdfFile.pageNames[i]);
          outputOriginalPageNumbers.push(pdfFile.originalPageNumbers[i]);
          pageCounter++;

          if (pageCounter === fixedSplitSize) {
            const bytes = await outputDoc.save();
            results.push({
              file: new File(
                [bytes as unknown as BlobPart],
                pdfFile.file.name,
                { type: "application/pdf" },
              ),
              pageNames: outputPageNames,
              originalPageNumbers: outputOriginalPageNumbers,
            });
            outputDoc = await PDFDocument.create();
            outputPageNames = [];
            outputOriginalPageNumbers = [];
            pageCounter = 0;
          }
        }
      }

      // Don't forget the last chunk if it has remaining pages
      if (pageCounter > 0) {
        const bytes = await outputDoc.save();
        results.push({
          file: new File(
            [bytes as unknown as BlobPart],
            loadedFiles[0].file.name,
            { type: "application/pdf" },
          ),
          pageNames: outputPageNames,
          originalPageNumbers: outputOriginalPageNumbers,
        });
      }

      const newFiles: PDFFile[] = [];
      for (const { file: newFile, pageNames, originalPageNumbers } of results) {
        const { pageCount, thumbnails } = await generateThumbnails(newFile);
        newFiles.push({
          id: Math.random().toString(36).slice(2),
          file: newFile,
          pageCount,
          thumbnails,
          pageNames,
          originalPageNumbers,
          isLoading: false,
        });
      }

      set({ files: newFiles });
    } catch (err) {
      console.error("Fixed page split failed:", err);
      alert("固定页数拆分失败，请检查文件是否有效");
      set((s) => ({
        files: s.files.map((f) => ({ ...f, isSplitting: false })),
      }));
    }
  },
}));

// 只要 files 变化且全部加载完毕，就自动更新 customRange 并切换到 custom-split 模式
usePdfStore.subscribe((state, prevState) => {
  if (state.files === prevState.files) return;

  const loadedFiles = state.files.filter((f) => f.pageCount > 0);
  if (
    loadedFiles.length > 0 &&
    loadedFiles.length === state.files.length
  ) {
    const newRange = computeCustomRange(state.files);
    usePdfStore.setState({ customRange: newRange });
  }
});
