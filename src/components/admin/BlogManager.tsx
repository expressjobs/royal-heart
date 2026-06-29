import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPost,
  deletePost,
  listAllPosts,
  slugify,
  updatePost,
  type BlogPost,
} from "@/lib/blog";
import { audit } from "@/lib/admin.functions";
import { MediaPicker } from "@/components/cms/MediaPicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function BlogManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BlogPost | null>(null);

  const load = useCallback(async () => {
    try {
      setPosts(await listAllPosts());
    } catch {
      toast.error("Could not load blog posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    try {
      const title = "Untitled post";
      const created = await createPost({
        title,
        slug: `${slugify(title)}-${Date.now().toString(36)}`,
        status: "draft",
      });
      audit({ action: "blog.create", entityType: "blog_post", entityId: created.id });
      setPosts((p) => [created, ...p]);
      setEditing(created);
    } catch {
      toast.error("Could not create post.");
    }
  };

  const save = async () => {
    if (!editing) return;
    try {
      const slug = slugify(editing.slug || editing.title);
      const publishedAt =
        editing.status === "published" && !editing.published_at
          ? new Date().toISOString()
          : editing.status === "draft"
            ? null
            : editing.published_at;
      await updatePost(editing.id, {
        title: editing.title,
        slug,
        excerpt: editing.excerpt,
        body: editing.body,
        cover_path: editing.cover_path,
        status: editing.status,
        published_at: publishedAt,
        seo_title: editing.seo_title,
        seo_description: editing.seo_description,
      });
      audit({
        action: "blog.update",
        entityType: "blog_post",
        entityId: editing.id,
        details: { status: editing.status },
      });
      toast.success(editing.status === "published" ? "Post published" : "Draft saved");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(
        e instanceof Error && e.message.includes("duplicate")
          ? "That slug is already taken."
          : "Could not save post.",
      );
    }
  };

  const remove = async (id: string) => {
    try {
      await deletePost(id);
      setPosts((p) => p.filter((x) => x.id !== id));
      audit({ action: "blog.delete", entityType: "blog_post", entityId: id });
      if (editing?.id === id) setEditing(null);
    } catch {
      toast.error("Could not delete post.");
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (editing) {
    const e = editing;
    const set = (patch: Partial<BlogPost>) =>
      setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
    return (
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Edit post</h3>
          <label className="flex items-center gap-2 text-xs font-medium">
            <Switch
              checked={e.status === "published"}
              onCheckedChange={(v) => set({ status: v ? "published" : "draft" })}
            />
            {e.status === "published" ? "Published" : "Draft"}
          </label>
        </div>
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={e.title} onChange={(ev) => set({ title: ev.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input
            value={e.slug}
            onChange={(ev) => set({ slug: ev.target.value })}
            onBlur={(ev) => set({ slug: slugify(ev.target.value) })}
          />
          <p className="text-xs text-muted-foreground">URL: /blog/{slugify(e.slug || e.title)}</p>
        </div>
        <div className="space-y-1.5">
          <Label>Excerpt</Label>
          <Textarea
            value={e.excerpt ?? ""}
            rows={2}
            onChange={(ev) => set({ excerpt: ev.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Body</Label>
          <Textarea
            value={e.body ?? ""}
            rows={12}
            onChange={(ev) => set({ body: ev.target.value })}
          />
        </div>
        <MediaPicker
          label="Cover image"
          value={e.cover_path}
          folder="blog"
          onChange={(p) => set({ cover_path: p })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>SEO title</Label>
            <Input
              value={e.seo_title ?? ""}
              onChange={(ev) => set({ seo_title: ev.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>SEO description</Label>
            <Input
              value={e.seo_description ?? ""}
              onChange={(ev) => set({ seo_description: ev.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Write and publish blog articles.</p>
        <Button onClick={add} size="sm">
          <Plus className="mr-1 h-4 w-4" /> New post
        </Button>
      </div>
      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts yet.</p>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  <span className={p.status === "published" ? "text-primary" : ""}>{p.status}</span>
                  {p.published_at && ` · ${new Date(p.published_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => remove(p.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
