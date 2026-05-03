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
