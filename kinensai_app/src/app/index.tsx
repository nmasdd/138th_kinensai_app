import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "./components/Header";

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <Header title="ホーム" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>ホーム画面</Text>
      </View>
    </SafeAreaView>
  );
}