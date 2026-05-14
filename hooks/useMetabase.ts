"use client";

import { useState, useCallback } from "react";
import { MetabaseDatabase } from "@/lib/types";

export function useMetabase(
  metabaseUrl: string,
  metabaseEmail: string,
  metabasePassword: string,
  savedToken: string | null,
  saveToken: (t: string) => void
) {
  const [token, setToken] = useState<string | null>(savedToken);
  const [databases, setDatabases] = useState<MetabaseDatabase[]>([]);
  const [schemaContext, setSchemaContext] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const authRes = await fetch("/api/metabase/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metabaseUrl, email: metabaseEmail, password: metabasePassword }),
      });
      const authData = await authRes.json();
      if (!authRes.ok) throw new Error(authData.error);

      const newToken = authData.token;
      setToken(newToken);
      saveToken(newToken);

      const dbRes = await fetch("/api/metabase/databases", {
        headers: {
          "x-metabase-url": metabaseUrl,
          "x-metabase-token": newToken,
        },
      });
      const dbData = await dbRes.json();
      if (!dbRes.ok) throw new Error(dbData.error);
      setDatabases(dbData.databases);
      return { token: newToken, databases: dbData.databases as MetabaseDatabase[] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setIsConnecting(false);
    }
  }, [metabaseUrl, metabaseEmail, metabasePassword, saveToken]);

  const loadSchema = useCallback(
    async (databaseId: number, currentToken: string) => {
      const res = await fetch(
        `/api/metabase/schema?database_id=${databaseId}`,
        {
          headers: {
            "x-metabase-url": metabaseUrl,
            "x-metabase-token": currentToken,
          },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSchemaContext(data.schemaText);
      return data.schemaText as string;
    },
    [metabaseUrl]
  );

  return { token, databases, schemaContext, isConnecting, error, connect, loadSchema };
}
