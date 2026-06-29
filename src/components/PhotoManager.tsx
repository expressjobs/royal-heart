import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deletePhotoFile, getSignedUrls } from "@/lib/storage";
import { uploadProfilePhoto } from "@/lib/photos.functions";
import { photoPath } from "@/lib/profiles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Photo {
  id: string;
  url: string; // storage path
  storage_path: string | null;
  position: number;
  is_primary: boolean;
}

const MAX_PHOTOS = 6;

export function PhotoManager({
  userId,
  onChange,
}: {
  userId: string;
  onChange?: (count: number) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const uploadPhotoFn = useServerFn(uploadProfilePhoto);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("profile_photos")
      .select("id, url, storage_path, position, is_primary")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("position", { ascending: true });
    const list = data ?? [];
    setPhotos(list);
    onChange?.(list.length);
    const map = await getSignedUrls(list.map((p) => photoPath(p)).filter((p): p is string => !!p));
    setSigned(map);
  }, [userId, onChange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) {
      toast.error(`You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setUploading(true);
    try {
      // Track count locally so multi-file batches get correct position / primary.
      let count = photos.length;
      for (const file of toUpload) {
        if (!file.type.startsWith("image/")) {
          toast.error("Only image files are allowed.");
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          toast.error("Each photo must be under 8MB.");
          continue;
        }
        const form = new FormData();
        form.append("file", file);
        const result = await uploadPhotoFn({ data: form });
        if (!result.ok) {
          console.error("[profile-photo-upload] Server upload failed", result.error);
          toast.error(result.error);
          continue;
        }
        const { error: insertError } = await supabase.from("profile_photos").insert({
          user_id: userId,
          url: result.path,
          storage_path: result.path,
          position: count,
          is_primary: count === 0,
        });
        if (insertError) {
          console.error("[profile-photo-upload] profile_photos insert failed", {
            path: result.path,
            message: insertError.message,
            code: insertError.code,
            details: insertError.details,
          });
          await deletePhotoFile(result.path);
          toast.error(`Photo uploaded, but profile update failed: ${insertError.message}`);
          continue;
        }
        count += 1;
      }
      await load();
      toast.success(toUpload.length > 1 ? "Photos added" : "Photo added");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (photo: Photo) => {
    await supabase.from("profile_photos").delete().eq("id", photo.id);
    const path = photoPath(photo);
    if (path) await deletePhotoFile(path);
    if (photo.is_primary) {
      const next = photos.find((p) => p.id !== photo.id);
      if (next)
        await supabase.from("profile_photos").update({ is_primary: true }).eq("id", next.id);
    }
    await load();
  };

  const makePrimary = async (photo: Photo) => {
    await supabase.from("profile_photos").update({ is_primary: false }).eq("user_id", userId);
    await supabase.from("profile_photos").update({ is_primary: true }).eq("id", photo.id);
    await load();
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-muted"
        >
          {photoPath(photo) && signed[photoPath(photo)!] ? (
            <img
              src={signed[photoPath(photo)!]}
              alt="Your profile"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {photo.is_primary && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gradient-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              <Star className="h-3 w-3" fill="currentColor" /> Main
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
            {!photo.is_primary && (
              <button
                onClick={() => makePrimary(photo)}
                className="rounded-full bg-background/90 p-1.5 text-foreground hover:bg-background"
                aria-label="Set as main photo"
              >
                <Star className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => removePhoto(photo)}
              className="ml-auto rounded-full bg-background/90 p-1.5 text-destructive hover:bg-background"
              aria-label="Remove photo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      {photos.length < MAX_PHOTOS && (
        <label
          className={cn(
            "flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs font-medium">Add photo</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      )}
    </div>
  );
}

export { MAX_PHOTOS };
