import { Tabs } from "expo-router";
import { Image, Text } from "react-native";

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
      initialRouteName="index"
    >
      {/* 通知画面はタブに表示せず、Headerのベルから遷移する */}
      <Tabs.Screen name="notifications" options={{ href: null }} />

      <Tabs.Screen
        name="camera"
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('../../icon/QR.png')}
              style={{
                width: 40,
                height: 40,
                opacity: focused ? 1 : 0.5,
              }}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('../../icon/time.png')}
              style={{
                width: 40,
                height: 40,
                opacity: focused ? 1 : 0.5,
              }}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('../../icon/Theme.png')}
              style={{
                width: 40,
                height: 40,
                opacity: focused ? 1 : 0.5,
              }}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('../../icon/Search.png')}
              style={{
                width: 40,
                height: 40,
                opacity: focused ? 1 : 0.5,
              }}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 32, opacity: focused ? 1 : 0.5 }}>🗺️</Text>
          ),
        }}
      />
    </Tabs>
  );
}