import { createContext, useContext } from "react";

export const SurveyContext = createContext(null);
export const useSurveyInfo = () => useContext(SurveyContext);
