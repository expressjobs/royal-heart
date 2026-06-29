import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type BlogPost = Database["public"]["Tables"]["blog_posts"]["Row"];
export type BlogPostInsert = Database["public"]["Tables"]["blog_posts"]["Insert"];
export type BlogPostUpdate = Database["public"]["Tables"]["blog_posts"]["Update"];

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/** Admin: list every post (draft + published). */
export async function listAllPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPost(input: BlogPostInsert): Promise<BlogPost> {
  const { data, error } = await supabase.from("blog_posts").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updatePost(id: string, patch: BlogPostUpdate): Promise<void> {
  const { error } = await supabase.from("blog_posts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw error;
}
