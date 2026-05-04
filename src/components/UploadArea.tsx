import { useRef, useState, useEffect } from "react";
import { usePdfStore } from "../store/usePdfStore";
import type { PDFFile } from "../types/pdf";
import type { MergeTarget, DragMode } from "../utils/dnd";
import { getInsertIndex, getMergeTarget } from "../utils/dnd";
import ThumbnailView from "./ThumbnailView";

type PageDragMode = "page-reorder" | "page-move" | null;

interface PageDragState {
  sourceFileId: string;
  sourcePageIndex: number;
  mode: PageDragMode;
  insertIndex: number | null;
  mergeTarget: MergeTarget | null;
}

export default function UploadArea() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<MergeTarget | null>(null);
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());
  const [pageDraggingId, setPageDraggingId] = useState<string | null>(null);
  const [pageOverIndex, setPageOverIndex] = useState<{ fileId: string; index: number } | null>(null);
  const [rangeInputs, setRangeInputs] = useState<Record<string, string>>({});

  const dragState = useRef<{
    id: string | null;
    insertIndex: number | null;
    mode: DragMode;
    mergeTarget: MergeTarget | null;
  }>({ id: null, insertIndex: null, mode: null, mergeTarget: null });

  const pageDragState = useRef<PageDragState | null>(null);

  const files = usePdfStore((s) => s.files);
  const addFiles = usePdfStore((s) => s.addFiles);
  const removeFile = usePdfStore((s) => s.removeFile);
  const reorderFiles = usePdfStore((s) => s.reorderFiles);
  const reorderPages = usePdfStore((s) => s.reorderPages);
  const movePage = usePdfStore((s) => s.movePage);
  const mergeFiles = usePdfStore((s) => s.mergeFiles);
  const deletePage = usePdfStore((s) => s.deletePage);
  const deletePages = usePdfStore((s) => s.deletePages);

  function handleDeletePage(fileId: string, pageIndex: number) {
    const pdfFile = files.find((f) => f.id === fileId);
    if (pdfFile && pdfFile.pageCount <= 1) {
      removeFile(fileId);
    } else {
      deletePage(fileId, pageIndex);
    }
  }

  function handleRangeChange(fileId: string, value: string) {
    setRangeInputs(prev => ({ ...prev, [fileId]: value }));
  }

  function handleExtract(fileId: string) {
    const pdfFile = files.find((f) => f.id === fileId);
    if (!pdfFile) return;
    const input = rangeInputs[fileId];
    if (!input) return;

    const pagesToKeep = new Set<number>();
    const parts = input.split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= pdfFile.pageCount) pagesToKeep.add(i);
        }
      } else {
        const num = parseInt(trimmed);
        if (!isNaN(num) && num >= 1 && num <= pdfFile.pageCount) pagesToKeep.add(num);
      }
    }

    const indicesToDelete: number[] = [];
    for (let i = 0; i < pdfFile.pageCount; i++) {
      if (!pagesToKeep.has(i + 1)) {
        indicesToDelete.push(i);
      }
    }

    if (indicesToDelete.length > 0) {
      deletePages(fileId, indicesToDelete);
    }
  }

  useEffect(() => {
    setRangeInputs(prev => {
      const next = { ...prev };
      let changed = false;
      for (const file of files) {
        const expected = `1-${file.pageCount}`;
        if (next[file.id] !== expected) {
          next[file.id] = expected;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [files]);

  function handleClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    e.target.value = "";
  }

  function handlePointerDown(e: React.PointerEvent, id: string) {
    const deleteBtn = (e.target as HTMLElement).closest("[data-delete-btn]");
    if (deleteBtn) return;

    const expandBtn = (e.target as HTMLElement).closest("[data-expand-btn]");
    if (expandBtn) return;

    const extractBtn = (e.target as HTMLElement).closest("[data-extract-btn]");
    if (extractBtn) return;

    const rangeInput = (e.target as HTMLElement).closest("input[type=text]");
    if (rangeInput) return;

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const thumbnailEl = (e.target as HTMLElement).closest(
      "[data-thumbnail-target]",
    );
    const mode: DragMode = thumbnailEl ? "merge" : "reorder";

    dragState.current = { id, insertIndex: null, mode, mergeTarget: null };

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;

    function onPointerMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!isDragging && Math.sqrt(dx * dx + dy * dy) > 5) {
        isDragging = true;
        setDraggingId(id);
        setDragMode(mode);
      }

      if (isDragging) {
        if (mode === "merge") {
          const newTarget = getMergeTarget(
            moveEvent.clientX,
            moveEvent.clientY,
            id,
          );
          if (
            newTarget?.fileId !== dragState.current.mergeTarget?.fileId ||
            newTarget?.pageIndex !== dragState.current.mergeTarget?.pageIndex ||
            newTarget?.side !== dragState.current.mergeTarget?.side
          ) {
            dragState.current.mergeTarget = newTarget;
            setMergeTarget(newTarget);
          }
          if (overIndex !== null) setOverIndex(null);
        } else {
          const insertIndex = getInsertIndex(
            moveEvent.clientX,
            moveEvent.clientY,
          );
          if (insertIndex !== dragState.current.insertIndex) {
            dragState.current.insertIndex = insertIndex;
            setOverIndex(insertIndex);
          }
          if (mergeTarget !== null) setMergeTarget(null);
        }
      }
    }

    function onPointerUp() {
      target.releasePointerCapture(e.pointerId);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);

      if (isDragging) {
        if (mode === "merge" && dragState.current.mergeTarget) {
          const mt = dragState.current.mergeTarget;
          if (mt.fileId !== id) {
            mergeFiles(id, mt.fileId, mt.pageIndex, mt.side);
          }
        } else if (
          mode === "reorder" &&
          dragState.current.insertIndex !== null
        ) {
          const fromIndex = files.findIndex((f) => f.id === id);
          let toIndex = dragState.current.insertIndex;

          if (fromIndex !== -1) {
            const newFiles = [...files];
            const [removed] = newFiles.splice(fromIndex, 1);
            const adjustedToIndex =
              fromIndex < toIndex ? toIndex - 1 : toIndex;
            newFiles.splice(adjustedToIndex, 0, removed);
            reorderFiles(newFiles);
          }
        }
      }

      dragState.current = {
        id: null,
        insertIndex: null,
        mode: null,
        mergeTarget: null,
      };
      setDraggingId(null);
      setDragMode(null);
      setOverIndex(null);
      setMergeTarget(null);
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  function handlePagePointerDown(
    e: React.PointerEvent,
    fileId: string,
    pageIndex: number,
  ) {
    if (!expandedFileIds.has(fileId)) return;

    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    pageDragState.current = {
      sourceFileId: fileId,
      sourcePageIndex: pageIndex,
      mode: null,
      insertIndex: null,
      mergeTarget: null,
    };

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;

    function onPointerMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!isDragging && Math.sqrt(dx * dx + dy * dy) > 5) {
        isDragging = true;
        setPageDraggingId(`${fileId}-${pageIndex}`);
        pageDragState.current!.mode = "page-reorder";
      }

      if (isDragging && pageDragState.current) {
        const otherCardThumb = getThumbnailAtPoint(moveEvent.clientX, moveEvent.clientY);
        const targetFileId = otherCardThumb?.getAttribute("data-file-id") || null;
        const targetPageIdx = otherCardThumb ? parseInt(otherCardThumb.getAttribute("data-page-index") || "0") : null;

        if (pageDragState.current.mode === "page-reorder") {
          if (targetFileId && targetFileId !== fileId && expandedFileIds.has(targetFileId)) {
            // Switch to page-move mode
            pageDragState.current.mode = "page-move";
            const side = moveEvent.clientX < (otherCardThumb!.getBoundingClientRect().left + otherCardThumb!.getBoundingClientRect().right) / 2 ? "left" : "right";
            pageDragState.current.mergeTarget = { fileId: targetFileId, pageIndex: targetPageIdx!, side };
            setMergeTarget(pageDragState.current.mergeTarget);
            setPageOverIndex(null);
          } else {
            const insertIdx = getPageInsertIndex(moveEvent.clientX, moveEvent.clientY, fileId);
            pageDragState.current.insertIndex = insertIdx;
            setPageOverIndex({ fileId, index: insertIdx });
            if (mergeTarget !== null) setMergeTarget(null);
          }
        } else if (pageDragState.current.mode === "page-move") {
          if (targetFileId && targetFileId === fileId && expandedFileIds.has(targetFileId)) {
            // Switch back to page-reorder mode
            pageDragState.current.mode = "page-reorder";
            pageDragState.current.mergeTarget = null;
            setMergeTarget(null);
            const insertIdx = getPageInsertIndex(moveEvent.clientX, moveEvent.clientY, fileId);
            pageDragState.current.insertIndex = insertIdx;
            setPageOverIndex({ fileId, index: insertIdx });
          } else if (targetFileId && targetFileId !== fileId && expandedFileIds.has(targetFileId)) {
            const side = moveEvent.clientX < (otherCardThumb!.getBoundingClientRect().left + otherCardThumb!.getBoundingClientRect().right) / 2 ? "left" : "right";
            const needsUpdate = !pageDragState.current.mergeTarget ||
              pageDragState.current.mergeTarget.fileId !== targetFileId ||
              pageDragState.current.mergeTarget.pageIndex !== targetPageIdx ||
              pageDragState.current.mergeTarget.side !== side;
            if (needsUpdate) {
              pageDragState.current.mergeTarget = { fileId: targetFileId, pageIndex: targetPageIdx!, side };
              setMergeTarget({ fileId: targetFileId, pageIndex: targetPageIdx!, side });
            }
          } else {
            pageDragState.current.mergeTarget = null;
            setMergeTarget(null);
          }
        }
      }
    }

    function onPointerUp() {
      target.releasePointerCapture(e.pointerId);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);

      if (isDragging && pageDragState.current) {
        const { sourceFileId, sourcePageIndex, mode, insertIndex, mergeTarget } = pageDragState.current;

        if (mode === "page-reorder" && insertIndex !== null) {
          const sourceFile = files.find((f) => f.id === sourceFileId);
          if (sourceFile) {
            const fromIdx = sourcePageIndex;
            const toIdx = insertIndex;
            if (fromIdx !== toIdx) {
              reorderPages(sourceFileId, fromIdx, toIdx);
            }
          }
        } else if (mode === "page-move" && mergeTarget) {
          movePage(sourceFileId, sourcePageIndex, mergeTarget.fileId, mergeTarget.pageIndex, mergeTarget.side);
        }
      }

      pageDragState.current = null;
      setPageDraggingId(null);
      setPageOverIndex(null);
      setMergeTarget(null);
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  function getThumbnailAtPoint(x: number, y: number): HTMLElement | null {
    const thumbnails = document.querySelectorAll("[data-thumbnail-target]");
    for (const el of thumbnails) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return el as HTMLElement;
      }
    }
    return null;
  }

  function getPageInsertIndex(x: number, y: number, excludeFileId: string): number {
    const thumbnails = Array.from(
      document.querySelectorAll(`[data-file-id="${excludeFileId}"] [data-thumbnail-target]`),
    ) as HTMLElement[];

    if (thumbnails.length === 0) return 0;

    // Find the thumbnail closest to cursor by vertical distance to midpoint
    let closestIndex = 0;
    let closestDist = Infinity;

    for (let i = 0; i < thumbnails.length; i++) {
      const rect = thumbnails[i].getBoundingClientRect();
      const midY = (rect.top + rect.bottom) / 2;
      const dist = Math.abs(y - midY);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }

    const closestRect = thumbnails[closestIndex].getBoundingClientRect();
    const midX = (closestRect.left + closestRect.right) / 2;

    if (x <= midX) {
      return closestIndex;
    } else {
      return closestIndex + 1;
    }
  }

  return (
    <div className="h-[90%] p-2">
      <div
        className={`w-full h-full border-2 border-dashed rounded-2xl transition-colors border-gray-300 flex flex-col ${
          files.length === 0 ? "items-center justify-center" : ""
        }`}
      >
        <div
          className={`flex justify-center pt-4 pb-2 ${
            files.length > 0 ? "shrink-0" : ""
          }`}
        >
          <button
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            onClick={handleClick}
          >
            上传PDF
          </button>
        </div>
        {files.length > 0 && (
          <div className="flex-1 overflow-auto">
            <div className="min-h-full flex flex-wrap items-center justify-center gap-8 p-4">
              {files.map((file, index) => (
                <div
                  key={file.id}
                  data-file-id={file.id}
                  onPointerDown={(e) => handlePointerDown(e, file.id)}
                  className={`relative flex flex-col items-center gap-2 border border-solid border-gray-200 bg-gray-50/50 rounded-xl p-4 cursor-move transition-all select-none hover:border-blue-400 hover:shadow-md has-[[data-thumbnail-target]:hover]:border-gray-200 has-[[data-thumbnail-target]:hover]:shadow-none ${
                    draggingId === file.id
                      ? "opacity-50 scale-95 shadow-lg"
                      : ""
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1 justify-center">
                    <input
                      type="text"
                      className="w-24 text-xs py-0.5 px-1.5 border border-gray-300 rounded focus:outline-none focus:border-blue-400"
                      value={rangeInputs[file.id] ?? ""}
                      onChange={(e) => handleRangeChange(file.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      data-extract-btn
                      className="shrink-0 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs rounded cursor-pointer transition-colors"
                      disabled={!rangeInputs[file.id] || rangeInputs[file.id] === `1-${file.pageCount}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExtract(file.id);
                      }}
                    >
                      截取
                    </button>
                  </div>
                  <button
                    data-delete-btn
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md cursor-pointer z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.id);
                    }}
                    title="移除该PDF"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center">
                    {index + 1}
                  </div>
                  {dragMode === "reorder" && overIndex === index && (
                    <div className="absolute -left-2 top-2 bottom-2 w-1 bg-blue-400 rounded pointer-events-none" />
                  )}
                  {dragMode === "reorder" &&
                    overIndex === files.length &&
                    index === files.length - 1 && (
                      <div className="absolute -right-2 top-2 bottom-2 w-1 bg-blue-400 rounded pointer-events-none" />
                    )}
                  {file.isLoading || file.isMerging ? (
                    <LoadingPlaceholder file={file} isMerging={file.isMerging} />
                  ) : (
                    <div className={`flex flex-col items-center rounded-lg border-2 border-transparent transition-colors ${
                      expandedFileIds.has(file.id)
                        ? ""
                        : "has-[[data-thumbnail-target]:hover]:border-amber-400 has-[[data-thumbnail-target]:hover]:bg-amber-50/30"
                    }`}>
                      <div className={`flex items-center gap-2 flex-wrap max-w-80 justify-center ${expandedFileIds.has(file.id) ? "max-h-80 overflow-y-auto" : ""}`}>
                        <ThumbnailView
                          src={file.thumbnails[0]}
                          pageNum={1}
                          fileId={file.id}
                          pageIndex={0}
                          pageName={file.pageNames[0]}
                          originalPageNum={file.originalPageNumbers[0]}
                          dragMode={dragMode}
                          draggingId={draggingId}
                          mergeTarget={mergeTarget}
                          isExpanded={expandedFileIds.has(file.id)}
                          onPointerDown={handlePagePointerDown}
                          isPageDragging={!!pageDraggingId}
                          pageOverIndex={pageOverIndex}
                          isPageMoveTarget={!!pageDraggingId}
                          onDelete={handleDeletePage}
                        />

                        {file.pageCount === 2 && (
                          <ThumbnailView
                            src={file.thumbnails[1]}
                            pageNum={2}
                            fileId={file.id}
                            pageIndex={1}
                            pageName={file.pageNames[1]}
                            originalPageNum={file.originalPageNumbers[1]}
                            dragMode={dragMode}
                            draggingId={draggingId}
                            mergeTarget={mergeTarget}
                            isExpanded={expandedFileIds.has(file.id)}
                            onPointerDown={handlePagePointerDown}
                            isPageDragging={!!pageDraggingId}
                            pageOverIndex={pageOverIndex}
                            isPageMoveTarget={!!pageDraggingId}
                            onDelete={handleDeletePage}
                          />
                        )}

                        {file.pageCount > 2 && (
                          <>
                            {expandedFileIds.has(file.id) ? (
                              <>
                                {Array.from({ length: file.pageCount - 2 }, (_, i) => i + 1).map((pageIndex) => (
                                  <ThumbnailView
                                    key={pageIndex}
                                    src={file.thumbnails[pageIndex]}
                                    pageNum={pageIndex + 1}
                                    fileId={file.id}
                                    pageIndex={pageIndex}
                                    pageName={file.pageNames[pageIndex]}
                                    originalPageNum={file.originalPageNumbers[pageIndex]}
                                    dragMode={dragMode}
                                    draggingId={draggingId}
                                    mergeTarget={mergeTarget}
                                    isExpanded={true}
                                    onPointerDown={handlePagePointerDown}
                                    isPageDragging={!!pageDraggingId}
                                    pageOverIndex={pageOverIndex}
                                    isPageMoveTarget={!!pageDraggingId}
                                    onDelete={handleDeletePage}
                                  />
                                ))}
                                <ThumbnailView
                                  src={file.thumbnails[file.pageCount - 1]}
                                  pageNum={file.pageCount}
                                  fileId={file.id}
                                  pageIndex={file.pageCount - 1}
                                  pageName={file.pageNames[file.pageCount - 1]}
                                  originalPageNum={file.originalPageNumbers[file.pageCount - 1]}
                                  dragMode={dragMode}
                                  draggingId={draggingId}
                                  mergeTarget={mergeTarget}
                                  isExpanded={expandedFileIds.has(file.id)}
                                  onPointerDown={handlePagePointerDown}
                                  isPageDragging={!!pageDraggingId}
                                  pageOverIndex={pageOverIndex}
                                  isPageMoveTarget={!!pageDraggingId}
                                  onDelete={handleDeletePage}
                                />
                              </>
                            ) : (
                              <>
                                <button
                                  data-expand-btn
                                  className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 cursor-pointer transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedFileIds(prev => new Set([...prev, file.id]));
                                  }}
                                  title="展开所有页面"
                                >
                                  <span className="text-lg font-medium leading-none">···</span>
                                </button>
                                <ThumbnailView
                                  src={file.thumbnails[file.pageCount - 1]}
                                  pageNum={file.pageCount}
                                  fileId={file.id}
                                  pageIndex={file.pageCount - 1}
                                  pageName={file.pageNames[file.pageCount - 1]}
                                  originalPageNum={file.originalPageNumbers[file.pageCount - 1]}
                                  dragMode={dragMode}
                                  draggingId={draggingId}
                                  mergeTarget={mergeTarget}
                                  isExpanded={expandedFileIds.has(file.id)}
                                  onPointerDown={handlePagePointerDown}
                                  isPageDragging={!!pageDraggingId}
                                  pageOverIndex={pageOverIndex}
                                  isPageMoveTarget={!!pageDraggingId}
                                  onDelete={handleDeletePage}
                                />
                              </>
                            )}
                          </>
                        )}
                      </div>
                      {expandedFileIds.has(file.id) && (
                        <button
                          data-expand-btn
                          className="shrink-0 px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full cursor-pointer transition-colors text-sm mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedFileIds(prev => { const next = new Set(prev); next.delete(file.id); return next; });
                          }}
                        >
                          收起
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

function LoadingPlaceholder({ file, isMerging }: { file: PDFFile; isMerging?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-28 h-36 bg-white rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
        <svg
          className="animate-spin h-8 w-8 text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      <span
        className="text-xs text-gray-600 truncate max-w-28"
        title={file.pageNames[0]}
      >
        {file.pageNames[0]}
      </span>
      <span className="text-xs text-gray-500">{isMerging ? "合并中..." : "加载中..."}</span>
    </div>
  );
}
