import { createContext } from "react";

/** Lets the home page hero know whether the 3D scene is running, so it can show its CSS ring only as a fallback. */
export const SceneContext = createContext<{ ready: boolean; setReady: (ready: boolean) => void }>({
  ready: false,
  setReady: () => {},
});
