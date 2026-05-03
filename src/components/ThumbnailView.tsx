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
}: ThumbnailViewProps) {
  const isMergeSource = dragMode === "merge" && draggingId === fileId;
  const isTarget =
    dragMode === "merge" &&
    mergeTarget?.fileId === fileId &&
    mergeTarget.pageIndex === pageIndex;

  const cursorClass =
    dragMode === "reorder"
      ? "cursor-move"
      : isMergeSource
        ? "cursor-grabbing"
        : "cursor-grab";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        data-thumbnail-target
        data-file-id={fileId}
        data-page-index={pageIndex}
        className={`
          w-28 h-36 bg-white rounded-lg shadow-sm border flex items-center justify-center p-2 transition-colors relative
          ${cursorClass}
          ${isExpanded ? "hover:border-amber-400 hover:shadow-md" : ""}
          ${isTarget && mergeTarget?.side === "left" ? "border-l-4 border-l-blue-500" : ""}
          ${isTarget && mergeTarget?.side === "right" ? "border-r-4 border-r-blue-500" : ""}
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
