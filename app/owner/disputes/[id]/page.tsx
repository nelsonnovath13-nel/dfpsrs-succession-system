"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Note = {
  id: string;
  author_id: string | null;
  note_type: string;
  content: string;
  created_at: string;
};

type Evidence = {
  id: string;
  file_path: string;
  file_name: string | null;
  evidence_type: string;
};

const EVIDENCE_TYPES = ["document", "image", "audio", "video", "witness_statement"];

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();
  const [dispute, setDispute] = useState<any>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [comment, setComment] = useState("");
  const [evidenceType, setEvidenceType] = useState("document");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: d } = await supabase
      .from("dfp_disputes")
      .select("*, dfp_succession_records(title)")
      .eq("id", params.id)
      .single();
    setDispute(d);

    const { data: n } = await supabase
      .from("dfp_dispute_notes")
      .select("id, author_id, note_type, content, created_at")
      .eq("dispute_id", params.id)
      .order("created_at", { ascending: true });
    setNotes(n ?? []);

    const { data: ev } = await supabase
      .from("dfp_dispute_evidence")
      .select("id, file_path, file_name, evidence_type")
      .eq("dispute_id", params.id);
    setEvidence(ev ?? []);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("dfp_dispute_notes").insert({
      dispute_id: params.id,
      author_id: user.id,
      note_type: "comment",
      content: comment,
    });
    setComment("");
    load();
  }

  async function handleUpload(file: File) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/dispute-${params.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("dfp-documents").upload(path, file);
    if (uploadError) {
      alert(uploadError.message);
      return;
    }
    await supabase.from("dfp_dispute_evidence").insert({
      dispute_id: params.id,
      file_path: path,
      file_name: file.name,
      evidence_type: evidenceType,
      uploaded_by: user.id,
    });
    load();
  }

  async function viewEvidence(path: string) {
    const { data, error } = await supabase.storage.from("dfp-documents").createSignedUrl(path, 60);
    if (error || !data) {
      alert("Could not open file.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  if (loading || !dispute) {
    return (
      <DashboardShell role="owner">
        <p className="text-sm text-neutralDark">Loading…</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="owner">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold text-primary">{dispute.dfp_succession_records?.title}</h1>
        <StatusBadge status={dispute.status} />
      </div>
      <p className="text-xs text-neutralDark uppercase mb-4">{dispute.category}</p>
      <div className="card mb-6">
        <p className="text-sm text-neutralDark">{dispute.description}</p>
      </div>

      <div className="card mb-6">
        <h2 className="font-semibold text-primary mb-4 text-sm uppercase tracking-wide">Evidence</h2>
        {evidence.length === 0 ? (
          <p className="text-sm text-neutralDark mb-3">No evidence uploaded yet.</p>
        ) : (
          <ul className="space-y-1 mb-3">
            {evidence.map((ev) => (
              <li key={ev.id} className="text-sm flex items-center justify-between">
                <button onClick={() => viewEvidence(ev.file_path)} className="text-primary underline text-left">
                  {ev.file_name ?? ev.evidence_type}
                </button>
                <span className="text-xs text-neutralDark capitalize">{ev.evidence_type}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <select className="input-field text-xs py-1 w-40" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
            {EVIDENCE_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
          <input
            type="file"
            className="text-xs"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-primary mb-4 text-sm uppercase tracking-wide">Notes & Mediation</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-neutralDark mb-4">No notes yet.</p>
        ) : (
          <ul className="space-y-3 mb-4">
            {notes.map((n) => (
              <li key={n.id} className="border-l-2 border-primary pl-3">
                <p className="text-xs text-neutralDark uppercase">{n.note_type} · {new Date(n.created_at).toLocaleString()}</p>
                <p className="text-sm text-neutralDark">{n.content}</p>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input className="input-field" placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button type="submit" className="btn-primary text-sm">Post</button>
        </form>
      </div>
    </DashboardShell>
  );
}
