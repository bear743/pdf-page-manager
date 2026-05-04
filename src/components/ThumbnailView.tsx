import type { MergeTarget, DragMode } from "../utils/dnd";

interface ThumbnailViewProps {
  src: string | null;
  pageNum: number;
  fileId: string;
  pageIndex: number;
  pageName: string;
  originalPageNum?: number;
  dragMode: DragMode;
  draggingId: string | null;
  mergeTarget: MergeTarget | null;
  isExpanded: boolean;
  onPointerDown?: (e: React.PointerEvent, fileId: string, pageIndex: number) => void;
  isPageDragging?: boolean;
  pageOverIndex?: { fileId: string; index: number } | null;
  isPageMoveTarget?: boolean;
  onDelete?: (fileId: string, pageIndex: number) => void;
}

export default function ThumbnailView({
  src,
  pageNum,
  fileId,
  pageIndex,
  pageName,
  originalPageNum,
  dragMode,
  draggingId,
  mergeTarget,
  isExpanded,
  onPointerDown,
  isPageDragging,
  pageOverIndex,
  isPageMoveTarget,
  onDelete,
}: ThumbnailViewProps) {
  const isMergeSource = dragMode === "merge" && draggingId === fileId;
  const isTarget =
    (dragMode === "merge" || isPageMoveTarget) &&
    mergeTarget?.fileId === fileId &&
    mergeTarget.pageIndex === pageIndex;

  const isPageReorderSource = isPageDragging && draggingId === `${fileId}-${pageIndex}`;
  const isPageOverLeft = pageOverIndex?.fileId === fileId && pageOverIndex?.index === pageIndex;
  const isPageOverRight = pageOverIndex?.fileId === fileId && pageOverIndex?.index === pageIndex + 1;

  const cursorClass =
    dragMode === "reorder"
      ? "cursor-move"
      : isMergeSource || isPageReorderSource
        ? "cursor-grabbing"
        : onPointerDown && isExpanded
          ? "cursor-grab"
          : "cursor-grab";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        data-thumbnail-target
        data-file-id={fileId}
        data-page-index={pageIndex}
        onPointerDown={onPointerDown ? (e) => onPointerDown(e, fileId, pageIndex) : undefined}
        className={`
          w-28 h-36 bg-white rounded-lg shadow-sm border flex items-center justify-center p-2 transition-colors relative
          ${cursorClass}
          ${isExpanded && onPointerDown ? "hover:border-amber-400 hover:shadow-md" : ""}
          ${isTarget && mergeTarget?.side === "left" ? "border-l-4 border-l-blue-500" : ""}
          ${isTarget && mergeTarget?.side === "right" ? "border-r-4 border-r-blue-500" : ""}
          ${isPageReorderSource ? "opacity-50" : ""}
          ${isPageOverLeft ? "border-l-4 border-l-green-500" : ""}
          ${isPageOverRight ? "border-r-4 border-r-green-500" : ""}
        `}
      >
        {src && (
          <img
            src={src}
            className="max-w-full max-h-full object-contain"
            alt=""
            draggable={false}
          />
        )}
        {onDelete && (
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(fileId, pageIndex);
            }}
            className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md z-10 cursor-pointer"
            title="删除此页"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>
      <span
        className="text-xs text-gray-600 truncate max-w-28"
        title={pageName}
      >
        {pageName}
      </span>
      <span className="text-xs text-gray-500">
        {pageNum}
        {originalPageNum !== undefined && originalPageNum !== pageNum && (
          <span className="text-orange-500"> ({originalPageNum})</span>
        )}
      </span>
    </div>
  );
}
