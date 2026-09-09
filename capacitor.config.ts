import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "fans.goldenretriever.gldr",
  appName: "GoldenRetriever",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#d4a017",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#d4a017",
    },
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
};

export default config;
