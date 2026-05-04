import { usePdfStore } from "../store/usePdfStore";

export default function DownloadSettings() {
  const customRange = usePdfStore((s) => s.customRange);
  const setCustomRange = usePdfStore((s) => s.setCustomRange);
  const splitByCustomRange = usePdfStore((s) => s.splitByCustomRange);
  const fixedSplitSize = usePdfStore((s) => s.fixedSplitSize);
  const setFixedSplitSize = usePdfStore((s) => s.setFixedSplitSize);
  const splitByFixedPages = usePdfStore((s) => s.splitByFixedPages);
  const mergeAllFiles = usePdfStore((s) => s.mergeAllFiles);
  const downloadAllFiles = usePdfStore((s) => s.downloadAllFiles);

  return (
    <div className="h-[10%] flex flex-col">
      <div className="flex-1 flex items-center justify-center gap-30">
        <button
          onClick={mergeAllFiles}
          className="bg-blue-600 text-white rounded px-3 py-0.5 text-sm hover:bg-blue-700 transition-colors cursor-pointer"
        >
          合并全部
        </button>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="例：1-3,4"
            value={customRange}
            onChange={(e) => setCustomRange(e.target.value)}
            className="border border-gray-300 rounded px-2 py-0.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={splitByCustomRange}
            className="bg-blue-600 text-white rounded px-3 py-0.5 text-sm hover:bg-blue-700 transition-colors cursor-pointer"
          >
            自定义范围拆分
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="页数"
            min={1}
            value={fixedSplitSize}
            onChange={(e) => setFixedSplitSize(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-0.5 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={splitByFixedPages}
            className="bg-blue-600 text-white rounded px-3 py-0.5 text-sm hover:bg-blue-700 transition-colors cursor-pointer"
          >
            固定页数拆分
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={() => downloadAllFiles()}
          className="bg-green-600 text-white rounded-lg px-8 py-2 font-medium hover:bg-green-700 transition-colors cursor-pointer"
        >
          下载
        </button>
      </div>
    </div>
  );
}
