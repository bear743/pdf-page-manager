import { usePdfStore } from "../store/usePdfStore";

export default function DownloadSettings() {
  const mode = usePdfStore((s) => s.mode);
  const setMode = usePdfStore((s) => s.setMode);
  const customRange = usePdfStore((s) => s.customRange);
  const setCustomRange = usePdfStore((s) => s.setCustomRange);
  const splitByCustomRange = usePdfStore((s) => s.splitByCustomRange);

  return (
    <div className="h-[10%] flex flex-col">
      <div className="flex-1 flex items-center justify-center gap-16">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            checked={mode === "merge"}
            onChange={() => setMode("merge")}
            className="accent-blue-600"
          />
          <span className="text-sm">合并</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            checked={mode === "custom-split"}
            onChange={() => setMode("custom-split")}
            className="accent-blue-600"
          />
          <span className="text-sm">自定义范围拆分</span>
          <input
            type="text"
            placeholder="例：1-3,4"
            value={customRange}
            onChange={(e) => setCustomRange(e.target.value)}
            className="border border-gray-300 rounded px-2 py-0.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={splitByCustomRange}
            className="bg-blue-600 text-white rounded px-3 py-0.5 text-sm hover:bg-blue-700 transition-colors"
          >
            确定
          </button>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            checked={mode === "fixed-split"}
            onChange={() => setMode("fixed-split")}
            className="accent-blue-600"
          />
          <span className="text-sm">固定页数拆分</span>
          <input
            type="number"
            placeholder="页数"
            className="border border-gray-300 rounded px-2 py-0.5 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button className="bg-blue-600 text-white rounded px-3 py-0.5 text-sm hover:bg-blue-700 transition-colors">
            确定
          </button>
        </label>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <button className="bg-green-600 text-white rounded-lg px-8 py-2 font-medium hover:bg-green-700 transition-colors">
          下载
        </button>
      </div>
    </div>
  );
}
