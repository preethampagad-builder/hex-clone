"use client";

import { useState, useEffect, useCallback } from "react";
import { Credentials } from "@/lib/types";

const STORAGE_KEY = "hex_clone_credentials";

const defaultCreds: Credentials = {
  claudeApiKey: "",
  metabaseUrl: "",
  metabaseApiKey: "",
  metabaseEmail: "",
  metabasePassword: "",
  sphinxUrl: "",
  sphinxApiKey: "",
};

export function useCredentials() {
  const [credentials, setCredentialsState] = useState<Credentials>(defaultCreds);
  const [metabaseToken, setMetabaseToken] = useState<string | null>(null);
  const [metabaseAuthType, setMetabaseAuthType] = useState<string>("session");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCredentialsState({ ...defaultCreds, ...parsed.credentials });
        setMetabaseToken(parsed.metabaseToken ?? null);
        setMetabaseAuthType(parsed.metabaseAuthType ?? "session");
      }
    } catch {}
    setIsLoaded(true);
  }, []);

  const saveCredentials = useCallback((creds: Credentials, token?: string, authType?: string) => {
    setCredentialsState(creds);
    const tok = token ?? metabaseToken;
    const atype = authType ?? metabaseAuthType;
    if (tok) setMetabaseToken(tok);
    setMetabaseAuthType(atype);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ credentials: creds, metabaseToken: tok, metabaseAuthType: atype })
    );
  }, [metabaseToken, metabaseAuthType]);

  const saveToken = useCallback((token: string, authType = "session") => {
    setMetabaseToken(token);
    setMetabaseAuthType(authType);
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, metabaseToken: token, metabaseAuthType: authType }));
  }, []);

  const clearCredentials = useCallback(() => {
    setCredentialsState(defaultCreds);
    setMetabaseToken(null);
    setMetabaseAuthType("session");
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isConfigured =
    isLoaded &&
    !!credentials.metabaseUrl &&
    !!(credentials.metabaseApiKey || (credentials.metabaseEmail && credentials.metabasePassword));

  return {
    credentials,
    metabaseToken,
    metabaseAuthType,
    isLoaded,
    isConfigured,
    saveCredentials,
    saveToken,
    clearCredentials,
  };
}
