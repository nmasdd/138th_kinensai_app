import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "./components/Header";

export default function ReservationScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <Header title="予約一覧" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>予約一覧画面</Text>
      </View>
    </SafeAreaView>
  );
}