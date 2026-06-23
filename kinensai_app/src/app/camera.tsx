import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "./components/Header";

export default function CameraScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <Header title="カメラ" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>カメラ画面</Text>
      </View>
    </SafeAreaView>
  );
}