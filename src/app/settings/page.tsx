"use client";

import { useState, useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface SettingsData {
  hasAnthropicKey: boolean;
  anthropicKeyHint: string | null;
  hasGithubToken: boolean;
  githubTokenHint: string | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setSettings(data.data);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const payload: Record<string, string | null> = {};
    if (anthropicKey) payload.anthropicApiKey = anthropicKey;
    if (githubToken) payload.githubToken = githubToken;

    const res = await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.ok) {
      setMessage({ text: "Settings saved", ok: true });
      setAnthropicKey("");
      setGithubToken("");
      // Refresh hints
      const refresh = await fetch(`${BASE}/api/settings`);
      const refreshData = await refresh.json();
      if (refreshData.ok) setSettings(refreshData.data);
    } else {
      setMessage({ text: data.error || "Failed to save", ok: false });
    }
    setSaving(false);
  };

  const handleClear = async (field: "anthropicApiKey" | "githubToken") => {
    setSaving(true);
    const res = await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: null }),
    });
    const data = await res.json();
    if (data.ok) {
      const refresh = await fetch(`${BASE}/api/settings`);
      const refreshData = await refresh.json();
      if (refreshData.ok) setSettings(refreshData.data);
      setMessage({ text: "Key removed", ok: true });
    }
    setSaving(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-zinc-100">Settings</h1>
            <button
              onClick={() => { window.location.href = `${BASE}/`; }}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Back
            </button>
          </div>

          <p className="text-sm text-zinc-400 mb-6">
            Add your own API keys so agents use your accounts. Keys are encrypted at rest and never shown in full after saving.
          </p>

          {/* Anthropic API Key */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Anthropic API Key
            </label>
            {settings?.hasAnthropicKey && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-green-400 font-mono">
                  {settings.anthropicKeyHint}
                </span>
                <button
                  onClick={() => handleClear("anthropicApiKey")}
                  className="text-[10px] text-red-400 hover:text-red-300"
                  disabled={saving}
                >
                  Remove
                </button>
              </div>
            )}
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder={settings?.hasAnthropicKey ? "Enter new key to replace" : "sk-ant-..."}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-zinc-600 mt-1">
              Used by AI agents to call Claude. Get one at console.anthropic.com.
            </p>
          </div>

          {/* GitHub Token */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              GitHub Personal Access Token
            </label>
            {settings?.hasGithubToken && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-green-400 font-mono">
                  {settings.githubTokenHint}
                </span>
                <button
                  onClick={() => handleClear("githubToken")}
                  className="text-[10px] text-red-400 hover:text-red-300"
                  disabled={saving}
                >
                  Remove
                </button>
              </div>
            )}
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder={settings?.hasGithubToken ? "Enter new token to replace" : "ghp_..."}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-zinc-600 mt-1">
              Used for cloning private repos and pushing code. Needs repo scope.
            </p>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mb-4 rounded-lg px-3 py-2 text-xs ${
                message.ok
                  ? "bg-green-900/30 text-green-400"
                  : "bg-red-900/30 text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || (!anthropicKey && !githubToken)}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
