import { useCallback, useEffect, useState } from "react";
import { ArchiveRestore, Trash2, Archive as ArchiveIcon } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useData } from "../../lib/store";
import { fmt, relativeDay } from "../../lib/dates";
import type { Todo } from "../../lib/types";
import { Empty } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { SubHeader } from "./SubHeader";

export default function Archive() {
  const { reloadTodos } = useData();
  const toast = useToast();
  const [items, setItems] = useState<Todo[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("todos").select("*").not("archived_at", "is", null).order("archived_at", { ascending: false }).limit(300);
    setItems((data as Todo[]) ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const restore = async (t: Todo) => {
    setItems((l) => l?.filter((x) => x.id !== t.id) ?? null);
    await supabase.from("todos").update({ archived_at: null }).eq("id", t.id);
    await reloadTodos();
    toast.show("Teruggezet");
  };
  const remove = async (t: Todo) => {
    setItems((l) => l?.filter((x) => x.id !== t.id) ?? null);
    await supabase.from("todos").delete().eq("id", t.id);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <SubHeader title="Archief" subtitle="Afgevinkte taken gaan hier na een week naartoe" />
      <div className="card divide-y divide-line overflow-hidden">
        {items?.length === 0 && <Empty icon={<ArchiveIcon className="size-5" />} title="Archief is leeg" />}
        {items?.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className={`truncate ${t.done_at ? "text-muted line-through" : ""}`}>{t.title}</p>
              <p className="text-xs text-faint">
                {t.done_at ? `Afgevinkt ${fmt(t.done_at.slice(0, 10), "d MMM")}` : t.due_date ? relativeDay(t.due_date) : "Gearchiveerd"}
              </p>
            </div>
            <button onClick={() => restore(t)} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label="Terugzetten">
              <ArchiveRestore className="size-4" />
            </button>
            {t.source === "user" && (
              <button onClick={() => remove(t)} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-danger" aria-label="Verwijderen">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
