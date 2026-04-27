import { startTransition, useEffect, useState } from "react";
import { photos as seedPhotos, type Photo } from "@liam-frost/content";

import { apiUrl } from "../lib/api";

type PhotoDataStatus = "seed" | "loading" | "ready" | "offline";

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>(seedPhotos);
  const [status, setStatus] = useState<PhotoDataStatus>("seed");

  useEffect(() => {
    const controller = new AbortController();

    setStatus("loading");

    fetch(apiUrl("/api/photos"), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load photos: ${response.status}`);
        }
        return (await response.json()) as Photo[];
      })
      .then((nextPhotos) => {
        if (!Array.isArray(nextPhotos)) {
          throw new Error("Photo API returned an invalid payload");
        }

        startTransition(() => {
          setPhotos(nextPhotos);
          setStatus("ready");
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setStatus("offline");
      });

    return () => controller.abort();
  }, []);

  return { photos, status };
}
