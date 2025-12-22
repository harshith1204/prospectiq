import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strip common markdown formatting characters from text for display purposes
 */
export function stripMarkdown(text: string): string {
  if (!text) return text;

  return text
    // Remove headers (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers (* ** _ __)
    .replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2')
    // Remove inline code (`)
    .replace(/`([^`]+)`/g, '$1')
    // Remove code blocks (```...```)
    .replace(/```[\s\S]*?```/g, '')
    // Remove links ([text](url))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images (![alt](url))
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove strikethrough (~~text~~)
    .replace(/~~(.*?)~~/g, '$1')
    // Remove blockquotes (>)
    .replace(/^>\s+/gm, '')
    // Remove list markers (- * +)
    .replace(/^[-*+]\s+/gm, '')
    // Remove numbered lists (1. 2. etc)
    .replace(/^\d+\.\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Copy text to the clipboard with a fallback when the Clipboard API is blocked
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  const fallbackCopy = async () => {
    if (typeof document === "undefined") return false;

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      return document.execCommand("copy");
    } catch (err) {
      console.warn("Fallback copy failed", err);
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  };

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Clipboard API copy failed, trying fallback", err);
      return fallbackCopy();
    }
  }

  return fallbackCopy();
}
