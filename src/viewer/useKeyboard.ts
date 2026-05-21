import { useAppStore } from "@/state/useAppStore";
import { useEffect } from "react";

type KeyMap = {
  [key: string]: () => boolean | undefined;
};

export function useKeyboard(handlers: KeyMap) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      const handler = handlers[normalizedKey(event)];
      if (!handler) return;

      const handled = handler();
      if (handled !== false) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest("[contenteditable='true']")) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function normalizedKey(event: KeyboardEvent) {
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

export function useViewerKeyboard() {
  const store = useAppStore;
  const whenViewer = (
    action: (state: ReturnType<typeof store.getState>) => void,
  ) => {
    const state = store.getState();
    if (state.view !== "viewer") return false;
    action(state);
    return true;
  };

  useKeyboard({
    " ": () =>
      whenViewer((state) => {
        state.togglePlaying();
      }),
    ArrowRight: () =>
      whenViewer((state) => {
        state.setTime(
          Math.min(state.time + 0.5, state.selectedExerciseId ? 120 : 999),
        );
      }),
    ArrowLeft: () =>
      whenViewer((state) => {
        state.setTime(Math.max(0, state.time - 0.5));
      }),
    r: () =>
      whenViewer((state) => {
        state.setTime(0);
        state.setSpeed(1);
        if (state.playing) state.togglePlaying();
      }),
    "1": () => whenViewer((state) => state.setCamera("top")),
    "2": () => whenViewer((state) => state.setCamera("iso")),
    "3": () => whenViewer((state) => state.setCamera("broadcast")),
    Escape: () =>
      whenViewer((state) => {
        if (state.presentationMode) state.setPresentationMode(false);
      }),
  });
}
