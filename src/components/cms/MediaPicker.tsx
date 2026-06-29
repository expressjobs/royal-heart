import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { deleteSiteMedia, listSuperAdminMediaLibrary, uploadSiteMedia } from "@/lib/cms.functions";
import { getMediaUrl } from "@/lib/site-media";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface MediaPickerProps {
  value: string | null;
  onChange: (path: string | null) => void;
  label?: string;
  folder?: string;
  className?: string;
}

interface LibraryItem {
  path: string;
  file_name: string;
  alt_text: string | null;
  url?: string;
}

export function MediaPicker({
  value,
  onChange,
  label,
  folder = "general",
  className,
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (value) {
      getMediaUrl(value).then((u) => active && setPreviewUrl(u));
    } else {
      setPreviewUrl(null);
    }
    return () => {
      active = false;
    };
  }, [value]);

  return (
    <div className={className}>
      {label && <p className="mb-2 text-sm font-medium">{label}</p>}
      <div className="flex items-center gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                {value ? "Change image" : "Choose image"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Select an image</DialogTitle>
              </DialogHeader>
              <MediaBrowser
                folder={folder}
                onSelect={(path) => {
                  onChange(path);
                  setOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              className="text-muted-foreground"
            >
              <X className="mr-1 h-4 w-4" /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface MediaBrowserProps {
  folder?: string;
  onSelect: (path: string) => void;
}

/** Reusable upload + library browser. Also used standalone in the Media Library tab. */
export function MediaBrowser({ folder = "general", onSelect }: MediaBrowserProps) {
  const uploadFn = useServerFn(uploadSiteMedia);
  const listMediaFn = useServerFn(listSuperAdminMediaLibrary);
  const deleteMediaFn = useServerFn(deleteSiteMedia);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listMediaFn();
      const withUrls = await Promise.all(
        rows.map(async (r) => ({ ...r, url: (await getMediaUrl(r.path)) ?? undefined })),
      );
      setItems(withUrls);
    } catch {
      toast.error("Could not load media library.");
    } finally {
      setLoading(false);
    }
  }, [listMediaFn]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await uploadFn({ data: fd });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.warning) {
        toast.warning(res.warning);
      }
      toast.success("Image uploaded");
      onSelect(res.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown upload error";
      console.error("[cms-media-upload] Upload action failed", { message });
      toast.error(`Upload failed: ${message}`);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleDelete = async (path: string) => {
    const result = await deleteMediaFn({ data: { path } });
    if (!result.ok) {
      toast.error("Could not delete this image.");
      return;
    }
    setItems((prev) => prev.filter((i) => i.path !== path));
    toast.success("Image deleted");
  };

  return (
    <Tabs defaultValue="library">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="library">Library</TabsTrigger>
        <TabsTrigger value="upload">Upload</TabsTrigger>
      </TabsList>

      <TabsContent value="library" className="mt-4">
        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No images yet. Upload your first image.
          </p>
        ) : (
          <div className="grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.path}
                className="group relative overflow-hidden rounded-lg border border-border"
              >
                <button
                  type="button"
                  onClick={() => onSelect(item.path)}
                  className="block aspect-square w-full"
                >
                  {item.url ? (
                    <img
                      src={item.url}
                      alt={item.alt_text ?? item.file_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-full place-items-center text-xs text-muted-foreground">
                      …
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.path)}
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-md bg-background/80 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete image"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="upload" className="mt-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className={cn(
            "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors hover:border-primary/50",
            uploading && "opacity-60",
          )}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {uploading ? "Uploading…" : "Click to upload an image"}
          </span>
          <span className="text-xs text-muted-foreground">JPG, PNG or WebP · up to 10MB</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </TabsContent>
    </Tabs>
  );
}
