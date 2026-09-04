import { View, Image, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { theme } from "../theme";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => router.push('/notifications' as never)}
        accessibilityLabel="通知を開く"
      >
        <Image
          source={require('../../icon/Notification.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.iconButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    height: 48,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.ink,
  },
});
