const development =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV === "development";
const override = process.env.EXPO_PUBLIC_APP_ENV;
const environment =
  override === "production" || override === "development"
    ? override
    : development
      ? "development"
      : "production";
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (environment === "development"
    ? "http://localhost:8787"
    : typeof window !== "undefined"
      ? "/api"
      : "https://odissey-backend.andre-ritossa.workers.dev");
