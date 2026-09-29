export interface World {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

export interface SessionData {
  sessionId: string;
  worldId: string;
  createdAt: string;
}

export interface Message {
  type: "user" | "narrator" | "choice";
  text: string;
  timestamp?: Date;
  choiceNumber?: number; // For choice messages
}

export type BottomTabParamList = {
  WorldGeneration: undefined;
  WorldSelection: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<BottomTabParamList> | undefined;
  Session: { worldId: string; worldTitle?: string };
};
import type { NavigatorScreenParams } from "@react-navigation/native";
