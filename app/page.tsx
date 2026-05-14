"use client";

import { useState, useCallback, useEffect } from "react";
import { useCredentials } from "@/hooks/useCredentials";
import { useNotebookStore } from "@/store/notebook";
import { CredentialsModal } from "@/components/CredentialsModal";
import { Notebook } from "@/components/notebook/Notebook";
import { ConnectPanel } from "@/components/ConnectPanel";
import { DatabaseSelector } from "@/components/DatabaseSelector";
import { MetabaseDatabase, Credentials, QueryResult } from "@/lib/types";
import { Settings } from "lucide-react";

export default function Home() {
  const {
    credentials, metabaseToken, metabaseAuthType, isLoaded, isConfigured,
    saveCredentials,
  } = useCredentials();

  const [showModal, setShowModal] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [allDatabases, setAllDatabases] = useState<MetabaseDatabase[]>([]);
  const [selectedDb, setSelectedDb] = useState<MetabaseDatabase | null>(null);

  const { setDatabase, selectedDatabaseId, updateCell, applyFiltersToSql } = useNotebookStore();

  useEffect(() => {
    if (isLoaded && !isConfigured) setShowModal(true);
  }, [isLoaded, isConfigured]);

  // Load database list once credentials are ready
  useEffect(() => {
    if (!isLoaded || !isConfigured || !metabaseToken || allDatabases.length > 0) return;
    fetch("/api/metabase/databases", {
      headers: {
        "x-metabase-url": credentials.metabaseUrl,
        "x-metabase-token": metabaseToken,
        "x-metabase-auth-type": metabaseAuthType,
      },
    })
      .then((r) => r.json())
      .then((d) => { if (d.databases) setAllDatabases(d.databases); })
      .catch(() => setShowModal(true));
  }, [isLoaded, isConfigured, metabaseToken, metabaseAuthType, credentials.metabaseUrl, allDatabases.length]);

  const handleCredentialsSave = async (creds: Credentials, token: string, authType: string) => {
    saveCredentials(creds, token, authType);
    setAllDatabases([]); // force re-fetch with new creds
    try {
      const res = await fetch("/api/metabase/databases", {
        headers: {
          "x-metabase-url": creds.metabaseUrl,
          "x-metabase-token": token,
          "x-metabase-auth-type": authType,
        },
      });
      const data = await res.json();
      if (data.databases) setAllDatabases(data.databases);
    } catch {}
    setShowModal(false);
  };

  const handleSelectDb = useCallback(
    (db: MetabaseDatabase, bust = false) => {
      setSelectedDb(db);
      setDatabase(db.id);
      setIsLoadingSchema(true);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      fetch(`/api/metabase/schema?database_id=${db.id}${bust ? "&bust=1" : ""}`, {
        signal: controller.signal,
        headers: {
          "x-metabase-url": credentials.metabaseUrl,
          "x-metabase-token": metabaseToken ?? "",
          "x-metabase-auth-type": metabaseAuthType,
        },
      })
        .then(() => {})
        .catch(() => {})
        .finally(() => { clearTimeout(timeout); setIsLoadingSchema(false); });
    },
    [metabaseToken, metabaseAuthType, credentials.metabaseUrl, setDatabase]
  );

  const handleRunCell = useCallback(
    async (cellId: string) => {
      const cells = useNotebookStore.getState().cells;
      const cell = cells.find((c) => c.id === cellId);
      if (!cell || !cell.sql || !selectedDatabaseId) return;

      const resolvedSql = applyFiltersToSql(cell.sql);
      updateCell(cellId, { status: "running", error: undefined });

      try {
        const res = await fetch("/api/metabase/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-metabase-url": credentials.metabaseUrl,
            "x-metabase-token": metabaseToken ?? "",
            "x-metabase-auth-type": metabaseAuthType,
          },
          body: JSON.stringify({ databaseId: selectedDatabaseId, sql: resolvedSql }),
        });
        const data: QueryResult & { error?: string } = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? "Query failed");

        updateCell(cellId, { status: "success", result: data });
        const updatedCell = useNotebookStore.getState().cells.find((c) => c.id === cellId);
        if (updatedCell?.resultCellId) updateCell(updatedCell.resultCellId, { result: data });
        if (updatedCell?.chartCellId) updateCell(updatedCell.chartCellId, { result: data });
      } catch (e) {
        updateCell(cellId, {
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [selectedDatabaseId, metabaseToken, metabaseAuthType, credentials.metabaseUrl, applyFiltersToSql, updateCell]
  );

  if (!isLoaded) return null;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-zinc-800 px-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-violet-600 flex items-center justify-center text-xs font-bold">H</div>
          <span className="text-sm font-semibold text-zinc-200">Hex Clone</span>
        </div>
        <div className="h-4 w-px bg-zinc-800" />
        <DatabaseSelector
          databases={allDatabases}
          selectedId={selectedDatabaseId}
          onSelect={handleSelectDb}
          isLoadingSchema={isLoadingSchema}
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
          >
            <Settings size={11} />
            Connectors
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <Notebook
            metabaseUrl={credentials.metabaseUrl}
            metabaseToken={metabaseToken ?? ""}
            databaseId={selectedDatabaseId ?? 0}
            onRunCell={handleRunCell}
          />
        </div>
        <div className="w-[380px] shrink-0 overflow-hidden">
          {isConfigured ? (
            <ConnectPanel
              metabaseUrl={credentials.metabaseUrl}
              metabaseToken={metabaseToken ?? ""}
              metabaseAuthType={metabaseAuthType}
              databaseId={selectedDatabaseId ?? 0}
              databaseName={selectedDb?.name ?? ""}
              onOpenSettings={() => setShowModal(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center border-l border-zinc-800">
              <div>
                <p className="text-zinc-500 text-sm">Connect Metabase to start.</p>
                <button onClick={() => setShowModal(true)} className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500">
                  Connect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && <CredentialsModal onSave={handleCredentialsSave} />}
    </div>
  );
}
