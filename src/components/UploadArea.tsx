import { useRef, useState } from "react";
import { usePdfStore } from "../store/usePdfStore";
import type { PDFFile } from "../types/pdf";
import type { MergeTarget, DragMode } from "../utils/dnd";
import { getInsertIndex, getMergeTarget } from "../utils/dnd";
import ThumbnailView from "./ThumbnailView";

export default function UploadArea() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<MergeTarget | null>(null);

  const dragState = useRef<{
    id: string | null;
    insertIndex: number | null;
    mode: DragMode;
    mergeTarget: MergeTarget | null;
  }>({ id: null, insertIndex: null, mode: null, mergeTarget: null });

  const files = usePdfStore((s) => s.files);
  const addFiles = usePdfStore((s) => s.addFiles);
  const removeFile = usePdfStore((s) => s.removeFile);
  const reorderFiles = usePdfStore((s) => s.reorderFiles);
  const mergeFiles = usePdfStore((s) => s.mergeFiles);

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
                  className={`relative flex flex-col items-center gap-2 border border-solid border-gray-200 bg-gray-50/50 rounded-xl p-4 cursor-move transition-all select-none ${
                    draggingId === file.id
                      ? "opacity-50 scale-95 shadow-lg"
                      : ""
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    data-delete-btn
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md cursor-pointer z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.id);
                    }}
                    title="移除"
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
                    <div className="flex items-center gap-2">
                      <ThumbnailView
                        src={file.thumbnails[0]}
                        pageNum={1}
                        fileId={file.id}
                        pageIndex={0}
                        pageName={file.pageNames[0]}
                        dragMode={dragMode}
                        draggingId={draggingId}
                        mergeTarget={mergeTarget}
                      />

                      {file.pageCount === 2 && (
                        <ThumbnailView
                          src={file.thumbnails[1]}
                          pageNum={2}
                          fileId={file.id}
                          pageIndex={1}
                          pageName={file.pageNames[1]}
                          dragMode={dragMode}
                          draggingId={draggingId}
                          mergeTarget={mergeTarget}
                        />
                      )}

                      {file.pageCount > 2 && (
                        <>
                          <span className="text-gray-400 text-lg px-1">
                            ...{" "}
                          </span>
                          <ThumbnailView
                            src={file.thumbnails[1]}
                            pageNum={file.pageCount}
                            fileId={file.id}
                            pageIndex={1}
                            pageName={file.pageNames[file.pageCount - 1]}
                            dragMode={dragMode}
                            draggingId={draggingId}
                            mergeTarget={mergeTarget}
                          />
                        </>
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
