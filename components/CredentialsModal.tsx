"use client";

import { useState } from "react";
import { Credentials } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Database } from "lucide-react";

interface Props {
  onSave: (creds: Credentials, token: string, authType: string) => void;
}

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, "pr-10")}
      />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

export function CredentialsModal({ onSave }: Props) {
  const [metabaseUrl, setMetabaseUrl] = useState("");
  const [metabaseApiKey, setMetabaseApiKey] = useState("");
  const [metabaseAuthMode, setMetabaseAuthMode] = useState<"apikey" | "password">("apikey");
  const [metabaseEmail, setMetabaseEmail] = useState("");
  const [metabasePassword, setMetabasePassword] = useState("");
  const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleConnect = async () => {
    const usingApiKey = metabaseAuthMode === "apikey";
    if (!metabaseUrl) {
      setStatus("error"); setErrorMsg("Metabase URL is required."); return;
    }
    if (usingApiKey && !metabaseApiKey) {
      setStatus("error"); setErrorMsg("Enter your Metabase API key."); return;
    }
    if (!usingApiKey && (!metabaseEmail || !metabasePassword)) {
      setStatus("error"); setErrorMsg("Enter your Metabase email and password."); return;
    }

    setStatus("testing");
    setErrorMsg("");
    try {
      const res = await fetch("/api/metabase/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metabaseUrl,
          apiKey: usingApiKey ? metabaseApiKey : undefined,
          email: !usingApiKey ? metabaseEmail : undefined,
          password: !usingApiKey ? metabasePassword : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Metabase auth failed");
      setStatus("success");

      const creds: Credentials = {
        claudeApiKey: "",
        metabaseUrl,
        metabaseApiKey: usingApiKey ? metabaseApiKey : "",
        metabaseEmail: !usingApiKey ? metabaseEmail : "",
        metabasePassword: !usingApiKey ? metabasePassword : "",
        sphinxUrl: "",
        sphinxApiKey: "",
      };
      setTimeout(() => onSave(creds, data.token, data.authType), 600);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-8 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">Connect Metabase</h2>
          <p className="mt-1 text-sm text-zinc-400">Credentials are stored locally in your browser only.</p>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-400">
                <Database size={14} />
                <span>Metabase</span>
              </div>
              <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-xs">
                <button
                  onClick={() => setMetabaseAuthMode("apikey")}
                  className={cn("px-2.5 py-1 transition-colors", metabaseAuthMode === "apikey" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-200")}
                >
                  API Key
                </button>
                <button
                  onClick={() => setMetabaseAuthMode("password")}
                  className={cn("px-2.5 py-1 transition-colors", metabaseAuthMode === "password" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-200")}
                >
                  Email / Password
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="url"
                value={metabaseUrl}
                onChange={(e) => setMetabaseUrl(e.target.value)}
                placeholder="https://your-metabase.metabaseapp.com"
                className={inputClass}
              />

              {metabaseAuthMode === "apikey" ? (
                <>
                  <PasswordInput value={metabaseApiKey} onChange={setMetabaseApiKey} placeholder="mb_..." />
                  <p className="text-xs text-zinc-500">
                    In Metabase: Settings → Admin settings → API Keys → Create API Key
                  </p>
                </>
              ) : (
                <>
                  <input type="email" value={metabaseEmail} onChange={(e) => setMetabaseEmail(e.target.value)}
                    placeholder="Email" className={inputClass} />
                  <PasswordInput value={metabasePassword} onChange={setMetabasePassword} placeholder="Password" />
                  <p className="text-xs text-zinc-500">Only works if you have a password-based account (not Google SSO).</p>
                </>
              )}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-950/50 border border-red-800 p-3 text-sm text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {errorMsg}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={status === "testing" || status === "success"}
          className={cn("mt-6 w-full rounded-lg py-2.5 text-sm font-medium transition-all",
            status === "success" ? "bg-emerald-600 text-white" : "bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-60"
          )}
        >
          {status === "testing" && <Loader2 size={14} className="mr-2 inline animate-spin" />}
          {status === "success" && <CheckCircle size={14} className="mr-2 inline" />}
          {status === "testing" ? "Connecting…" : status === "success" ? "Connected!" : "Connect"}
        </button>
      </div>
    </div>
  );
}
