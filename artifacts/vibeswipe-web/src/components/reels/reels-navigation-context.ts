import { createContext } from "react";

export const ReelsNavigationVisibilityContext = createContext<(visible: boolean) => void>(() => {});
