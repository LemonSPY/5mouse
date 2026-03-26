"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface VersionEntry {
  id: string;
  label: string;
  timestamp: string;
  trigger: string;
  files: number;
  sizeBytes: number;
  active: boolean;
}

function LoginContent() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showAdmin, setShowAdmin] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      let data: { ok: boolean; error?: string };
      try {
        data = await res.json();
      } catch {
        data = { ok: false, error: `Server error (${res.status})` };
      }

      if (data.ok) {
        const callbackUrl = searchParams.get("callbackUrl") || "/";
        router.push(callbackUrl);
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const fetchVersions = async () => {
    try {
      const res = await fetch(`${BASE}/api/versions`);
      const data = await res.json();
      if (data.ok) {
        setVersions(data.data.versions);
        setActiveVersion(data.data.activeVersion);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (showAdmin) fetchVersions();
  }, [showAdmin]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    setAdminMsg(null);
    try {
      const res = await fetch(`${BASE}/api/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: `Manual snapshot` }),
      });
      const data = await res.json();
      if (data.ok) {
        setAdminMsg(`Snapshot created: ${data.data.id}`);
        fetchVersions();
      } else {
        setAdminMsg(`Error: ${data.error}`);
      }
    } catch (e) {
      setAdminMsg(`Error: ${e}`);
    }
    setSnapshotting(false);
  };

  const handleRestore = async (id: string) => {
    if (!confirm(`Restore version ${id}? The server will restart.`)) return;
    setRestoring(id);
    setAdminMsg(null);
    try {
      const res = await fetch(`${BASE}/api/versions/${id}/restore`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setAdminMsg("Restoring... server will restart in a moment.");
      } else {
        setAdminMsg(`Error: ${data.error}`);
      }
    } catch (e) {
      setAdminMsg(`Error: ${e}`);
    }
    setRestoring(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete version ${id}?`)) return;
    try {
      const res = await fetch(`${BASE}/api/versions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        fetchVersions();
      } else {
        setAdminMsg(`Error: ${data.error}`);
      }
    } catch (e) {
      setAdminMsg(`Error: ${e}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm">
        {/* Sign-in card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🐭</div>
            <h1 className="text-2xl font-bold text-zinc-100">Welcome</h1>
            <p className="text-sm text-zinc-500 mt-2">
              Enter password to continue
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-white" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Admin version toggle */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAdmin(!showAdmin)}
            className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors"
          >
            {showAdmin ? "Hide" : "Admin"}
          </button>
        </div>

        {/* Admin version panel */}
        {showAdmin && (
          <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-300">Versions</h2>
              <button
                onClick={handleSnapshot}
                disabled={snapshotting}
                className="rounded-lg bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {snapshotting ? "Saving..." : "Snapshot Now"}
              </button>
            </div>

            {adminMsg && (
              <div className="mb-3 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-400">
                {adminMsg}
              </div>
            )}

            {versions.length === 0 ? (
              <p className="text-xs text-zinc-600">No versions saved yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`rounded-lg border p-3 ${
                      v.active
                        ? "border-green-800 bg-green-950/30"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-200 truncate">
                            {v.label}
                          </span>
                          {v.active && (
                            <span className="shrink-0 rounded bg-green-800 px-1.5 py-0.5 text-[9px] font-bold text-green-200">
                              ACTIVE
                            </span>
                          )}
                          <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500">
                            {v.trigger}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-600 mt-1">
                          {new Date(v.timestamp).toLocaleString()} &middot; {v.files} files &middot; {formatSize(v.sizeBytes)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!v.active && (
                          <button
                            onClick={() => handleRestore(v.id)}
                            disabled={restoring !== null}
                            className="rounded bg-amber-700 px-2 py-1 text-[10px] font-medium text-amber-100 hover:bg-amber-600 disabled:opacity-50 transition-colors"
                          >
                            {restoring === v.id ? "..." : "Restore"}
                          </button>
                        )}
                        {!v.active && (
                          <button
                            onClick={() => handleDelete(v.id)}
                            className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-500 hover:bg-red-900 hover:text-red-300 transition-colors"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
