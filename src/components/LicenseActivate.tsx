import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function LicenseActivate() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!code.trim()) {
      setError("请输入激活码");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const success = await invoke<boolean>("verify_and_activate", { code });
      if (success) {
        window.location.reload();
      } else {
        setError("激活码无效或已过期");
      }
    } catch (e) {
      setError("激活失败，请重试");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleActivate();
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            PDF Page Manager
          </h1>
          <p className="text-gray-600">请输入激活码以继续使用</p>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="XXXX-XXXX-XXXX"
            className="w-full px-4 py-3 text-center text-lg font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        <button
          onClick={handleActivate}
          disabled={loading}
          className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
        >
          {loading ? "验证中..." : "激活"}
        </button>

      </div>
    </div>
  );
}

export default LicenseActivate;
