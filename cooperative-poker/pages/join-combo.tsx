import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "@appdeploy/client";

const EVENT_CODE_KEY = "attendee_event_code";
const DEVICE_TOKEN_KEY = "attendee_device_token";
const PLAYER_ID_KEY = "attendee_player_id";
const INVITE_CODE_KEY = "combo_invite_code";

function getStored(): { eventCode: string; deviceToken: string; playerId?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const eventCode = localStorage.getItem(EVENT_CODE_KEY);
    const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    if (eventCode && deviceToken) return { eventCode, deviceToken, playerId: playerId ?? undefined };
  } catch {}
  return null;
}

async function normalizeResponse(res: unknown): Promise<{ ok: boolean; status?: number; data: unknown }> {
  if (res && typeof (res as Response).text === "function") {
    const r = res as Response;
    let data: unknown = null;
    try {
      const text = await r.text();
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: r.ok, status: r.status, data };
  }
  if (res && typeof res === "object" && "data" in res) {
    const r = res as { data?: unknown; status?: number };
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, data: r.data };
  }
  return { ok: false, data: res };
}

function extractCodeFromScan(text: string): string | null {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    const param = url.searchParams.get("code") ?? url.searchParams.get("invite_code");
    if (param && /^\d{5}$/.test(param)) return param;
  } catch {}
  const match = trimmed.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}

export default function JoinComboPage() {
  const router = useRouter();
  const [stored, setStored] = useState<{ eventCode: string; deviceToken: string; playerId?: string } | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<unknown>(null);

  useEffect(() => {
    setStored(getStored());
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(INVITE_CODE_KEY);
      if (saved) setInviteCode(saved);
      // Auto-fill from URL query param (set by QR code)
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get("code") ?? params.get("invite_code");
      if (codeParam && /^\d{5}$/.test(codeParam)) setInviteCode(codeParam);
    }
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current) {
      const scanner = scannerRef.current as { stop: () => Promise<void>; clear: () => void };
      try { await scanner.stop(); } catch {}
      try { scanner.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const startScanner = async () => {
    setScanError(null);
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText: string) => {
          const code = extractCodeFromScan(decodedText);
          if (code) {
            setInviteCode(code);
            stopScanner();
          }
        },
        () => { /* ignore scan failures */ }
      );
    } catch {
      setScanError("Could not start camera. Please allow camera access and try again.");
      setScanning(false);
    }
  };

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJoin = async () => {
    if (!stored || !inviteCode.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/api/combo/join", {
        body: JSON.stringify({
          invite_code: inviteCode.trim(),
          ...(stored.playerId ? { player_id: stored.playerId } : { event_code: stored.eventCode, device_session_token: stored.deviceToken }),
        }),
        headers: { "Content-Type": "application/json" },
      });
      const { ok, data } = await normalizeResponse(res);
      if (ok) {
        if (typeof window !== "undefined") {
          localStorage.setItem(INVITE_CODE_KEY, inviteCode.trim());
          router.push("/icebreak");
          return;
        }
      } else {
        const err = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "Failed to join";
        setError(err);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Network error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (typeof window !== "undefined" && !stored && getStored() === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
        <Head><title>Join combo - Cooperative Poker</title></Head>
        <p className="text-slate-600">No event session. Please enter an event first.</p>
        <Link href="/" className="mt-4 text-slate-800 underline">Enter event</Link>
      </div>
    );
  }

  if (!stored) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Head><title>Join combo - Cooperative Poker</title></Head>
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <Head><title>Join combo - Cooperative Poker</title></Head>
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Join combo</h1>
          <button
            type="button"
            onClick={() => { stopScanner(); router.push("/home"); }}
            className="text-slate-600 hover:underline"
          >
            Cancel
          </button>
        </div>
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <form
            onSubmit={(e) => { e.preventDefault(); handleJoin(); }}
            className="space-y-4"
          >
            <label className="block text-slate-700 font-medium">5-digit invite code</label>
            <input
              type="text"
              maxLength={5}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.replace(/\D/g, ""))}
              placeholder="12345"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono text-lg"
            />
            <button
              type="submit"
              disabled={loading || inviteCode.length !== 5}
              className="w-full py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join combo"}
            </button>
          </form>

          <div className="border-t border-slate-200 pt-4">
            {!scanning ? (
              <button
                type="button"
                onClick={startScanner}
                className="w-full py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3m4-11h-3a1 1 0 01-1-1V3m0 0H9m3 3v3m0 3h3m-3 0v3m-3-3H9" />
                </svg>
                Scan QR code
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScanner}
                className="w-full py-2 text-slate-600 hover:underline text-sm"
              >
                Cancel scan
              </button>
            )}
            {scanError && <p className="text-red-600 text-sm mt-2">{scanError}</p>}
            <div
              id="qr-reader"
              className={`mt-3 rounded-lg overflow-hidden ${scanning ? "block" : "hidden"}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
