import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "./components/Header";

export default function SearchScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <Header title="検索" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>検索画面</Text>
      </View>
    </SafeAreaView>
  );
}