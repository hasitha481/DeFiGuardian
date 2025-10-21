import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function OpenInNewTab() {
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setPublicUrl(json.publicUrl || null);
      } catch (e) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const open = () => {
    const url = publicUrl || window.location.href;
    try {
      window.open(url, '_blank');
    } catch (e) {
      // fallback
      window.location.href = url;
    }
  };

  return (
    <Button onClick={open} variant="outline" size="default">
      Open in New Tab
    </Button>
  );
}
