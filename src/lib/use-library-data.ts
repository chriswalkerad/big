"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { Document, Project } from "@/types";
import type { AppError } from "@/lib/errors";
import { createStorageRepository } from "@/lib/storage";

export interface LibraryData {
  project: Project;
  documents: Document[];
}

export type LibrarySnapshot =
  | { status: "loading" }
  | { status: "ready"; data: LibraryData }
  | { status: "error"; error: AppError };

/** A loading snapshot used for the server render and the first client render. */
const LOADING: LibrarySnapshot = { status: "loading" };

/**
 * Read the project and its documents from the localStorage-backed
 * `StorageRepository` via `useSyncExternalStore` — the idiomatic way to subscribe
 * a component to an external store with first-class SSR support. The server (and
 * the first hydration render) gets the `loading` snapshot; the real, cached
 * client snapshot is read after mount, so there is no hydration mismatch and no
 * `setState`-in-effect. `reload()` busts the cache to re-read after a failure.
 */
export function useLibraryData(projectId: string): {
  snapshot: LibrarySnapshot;
  reload: () => void;
} {
  const [nonce, setNonce] = useState(0);

  // Compute the client snapshot once per (projectId, nonce). Memoising the VALUE
  // keeps `getSnapshot` referentially stable (no in-closure mutation), which is
  // what useSyncExternalStore requires to avoid an infinite read loop.
  const clientSnapshot = useMemo(
    () => readLibrary(projectId),
    // `nonce` participates so a reload re-reads storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, nonce],
  );
  const getSnapshot = useCallback(() => clientSnapshot, [clientSnapshot]);

  // No external mutation source to subscribe to here (single-tab, in-session),
  // so `subscribe` is a no-op; reload() drives re-reads explicitly.
  const subscribe = useCallback(() => () => {}, []);

  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => LOADING,
  );

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { snapshot, reload };
}

/** Read the project + its documents synchronously from storage. */
function readLibrary(projectId: string): LibrarySnapshot {
  let storageError: AppError | null = null;
  const repo = createStorageRepository({
    onError: (e) => {
      storageError = e;
    },
  });

  const project = repo.getProject(projectId);
  if (!project) {
    return {
      status: "error",
      error: storageError ?? {
        code: "DOC_NOT_FOUND",
        message: "That project could not be found.",
        retryable: false,
      },
    };
  }

  const documents = repo
    .listDocuments()
    .filter((doc) => doc.projectId === projectId);

  return { status: "ready", data: { project, documents } };
}
