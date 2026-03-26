"use client";

import { useState, useEffect } from "react";

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

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  const handleSignIn = async (provider: string) => {
    setLoading(provider);
    try {
      // Custom signIn: next-auth/react's signIn() doesn't include proxy prefix
      const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
      const { csrfToken } = await csrfRes.json();

      const res = await fetch(`${BASE}/api/auth/signin/${provider}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Auth-Return-Redirect": "1",
        },
        body: new URLSearchParams({
          csrfToken,
          callbackUrl: `${BASE}/`,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(null);
    }
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
              Sign in to start building with AI agents
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleSignIn("github")}
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              {loading === "github" ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              )}
              Continue with GitHub
            </button>

            <button
              onClick={() => handleSignIn("google")}
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              {loading === "google" ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </button>
          </div>

          <p className="text-center text-xs text-zinc-600 mt-6">
            By signing in, you agree to our terms of service
          </p>
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
