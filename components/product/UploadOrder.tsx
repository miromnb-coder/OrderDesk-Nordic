"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type UploadState = "idle" | "uploading" | "error";

export function UploadOrder({ onUploaded }: { onUploaded?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setState("uploading");
    setMessage("");

    try {
      if (file.type !== "application/pdf") {
        throw new Error("The first ingestion pipeline currently accepts PDF files only.");
      }
      if (file.size > 15 * 1024 * 1024) {
        throw new Error("PDF must be 15 MB or smaller.");
      }

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .limit(1)
        .single();

      if (membershipError || !membership) throw membershipError ?? new Error("Workspace not found.");

      const organizationId = membership.organization_id;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          organization_id: organizationId,
          source_type: "pdf",
          source_file_name: file.name,
          status: "received",
        })
        .select("id")
        .single();

      if (orderError || !order) throw orderError ?? new Error("Could not create the order.");

      const path = `${organizationId}/${order.id}/source.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("order-files")
        .upload(path, file, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw uploadError;
      }

      const { error: pathError } = await supabase
        .from("orders")
        .update({ source_storage_path: path })
        .eq("id", order.id);

      if (pathError) throw pathError;

      await supabase.from("order_events").insert({
        organization_id: organizationId,
        order_id: order.id,
        event_type: "uploaded",
        message: "Purchase order PDF uploaded.",
        metadata: { file_name: file.name, size_bytes: file.size },
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(
        "https://avwplztfgixsgfnymgoe.supabase.co/functions/v1/process-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ order_id: order.id }),
        }
      );

      if (!response.ok) {
        throw new Error("The PDF was stored, but the processing validation step failed.");
      }

      setState("idle");
      if (inputRef.current) inputRef.current.value = "";
      onUploaded?.();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  return (
    <div className="od-upload-control">
      <input
        ref={inputRef}
        className="od-hidden-input"
        type="file"
        accept="application/pdf"
        onChange={(event) => pickFile(event.target.files?.[0])}
      />
      <button
        className="od-primary-button"
        type="button"
        disabled={state === "uploading"}
        onClick={() => inputRef.current?.click()}
      >
        {state === "uploading" ? "Uploading…" : "Upload PDF"}
      </button>
      {message && <span className="od-upload-error">{message}</span>}
    </div>
  );
}
