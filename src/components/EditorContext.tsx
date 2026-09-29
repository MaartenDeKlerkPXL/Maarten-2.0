import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { TodoEditor, type TodoDraft } from "./TodoEditor";
import type { Todo } from "../lib/types";

interface EditorApi {
  openTodo: (t: Todo) => void;
  newTodo: (draft?: Partial<TodoDraft>) => void;
}

const EditorContext = createContext<EditorApi>({ openTodo: () => undefined, newTodo: () => undefined });

export function EditorProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<TodoDraft | null>(null);
  const openTodo = useCallback((t: Todo) => setDraft({ ...t }), []);
  const newTodo = useCallback((d?: Partial<TodoDraft>) => setDraft({ title: "", ...d }), []);
  const api = useMemo(() => ({ openTodo, newTodo }), [openTodo, newTodo]);
  return (
    <EditorContext.Provider value={api}>
      {children}
      {draft && <TodoEditor draft={draft} onClose={() => setDraft(null)} />}
    </EditorContext.Provider>
  );
}

export const useEditor = () => useContext(EditorContext);
