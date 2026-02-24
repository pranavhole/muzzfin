"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { PlusCircle, Loader2 } from "lucide-react";
import axios from "axios";

const formSchema = z.object({
  url: z.string().min(1, { message: "Please enter a song title or URL" }),
});

type FormValues = z.infer<typeof formSchema>;

interface AddSongFormProps {
  onAddSong: (url: string) => Promise<any>;
  className?: string;
}

interface Suggestion {
  title: string;
  url: string;
}

export function AddSongForm({ onAddSong, className }: AddSongFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: "" },
  });

  const watchUrl = form.watch("url");

  // 🔎 detect direct URL (YouTube, Spotify, SoundCloud)
  const isDirectUrl = (input: string) => {
    const urlPattern =
      /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|soundcloud\.com|spotify\.com)\/.+/;
    return urlPattern.test(input);
  };

  // 🎶 Fetch suggestions when user types (but not when it's a direct URL)
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!watchUrl || isDirectUrl(watchUrl)) {
        setSuggestions([]);
        return;
      }
      setLoadingSuggestions(true);
      try {
        const res = await axios.get(
          `/api/searchSongs?q=${encodeURIComponent(watchUrl)}`
        );
        setSuggestions(res.data.results || []);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(debounce);
  }, [watchUrl]);

  const onSubmit = async (values: FormValues) => {
    setStatusMessage(null);
    setIsSubmitting(true);
    try {
      if (!isDirectUrl(values.url)) {
        setStatusMessage({ type: "error", text: "❌ Please paste a direct YouTube, SoundCloud, or Spotify URL" });
        setIsSubmitting(false);
        return;
      }
      console.log("📤 Sending song:", values.url);
      await onAddSong(values.url);
      setStatusMessage({ type: "success", text: "✅ Song added to queue!" });
      form.reset();
      setSuggestions([]);
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to add song";
      console.error("Failed to add song:", error);
      setStatusMessage({ type: "error", text: `❌ ${errorMsg}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuggestionClick = async (suggestion: Suggestion) => {
    setStatusMessage(null);
    setIsSubmitting(true);
    try {
      await onAddSong(suggestion.url);
      setStatusMessage({ type: "success", text: "✅ Song added to queue!" });
      form.reset();
      setSuggestions([]);
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to add song";
      console.error("Failed to add song:", error);
      setStatusMessage({ type: "error", text: `❌ ${errorMsg}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={className}>
      {statusMessage && (
        <div className={`p-2 rounded-md mb-2 text-sm ${statusMessage.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {statusMessage.text}
        </div>
      )}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex items-start gap-2"
        >
          <div className="flex-1">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Paste URL or type lyrics/title..."
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* 🎶 Suggestions Dropdown */}
            {!isDirectUrl(watchUrl) && suggestions.length > 0 && (
              <div className="bg-white border rounded-lg mt-2 shadow-md max-h-60 overflow-y-auto">
                {loadingSuggestions ? (
                  <div className="p-2 text-sm text-gray-500">Loading...</div>
                ) : (
                  suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button" // ✅ prevent accidental form submit
                      onClick={() => handleSuggestionClick(s)}
                      className="w-full text-left p-2 hover:bg-gray-100 text-sm"
                    >
                      <strong>{s.title}</strong>
                      <div className="text-gray-500 text-xs truncate">
                        {s.url}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <PlusCircle className="h-4 w-4 mr-2" />
                <span>Add</span>
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
