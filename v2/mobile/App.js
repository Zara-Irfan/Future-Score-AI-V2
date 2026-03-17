import { StatusBar } from "react-native";
import { WebView } from "react-native-webview";

export default function App() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <WebView
        source={{ uri: "https://future-score-ai-v2.vercel.app" }}
        style={{ flex: 1, marginTop: 50 }}
      />
    </>
  );
}
