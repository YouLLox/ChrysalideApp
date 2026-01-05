import React from 'react';
import { View } from 'react-native';

import { Services } from '@/stores/account/types';
import { Stack } from '@/utils/native/AnimatedNavigator';
import { screenOptions } from "@/utils/theme/ScreenOptions";

export default function OnboardingLayout() {
    const newScreenOptions = React.useMemo(() => ({
        ...screenOptions,
        headerShown: false,
        headerBackVisible: true,
        headerTitle: '',
        gestureEnabled: false,
        headerTransparent: true,
        headerTintColor: "#FFFFFF",
        headerBackButtonDisplayMode: "minimal",
        headerBackButtonMenuEnabled: false
    }), []);

    return (
        <View style={{ flex: 1, backgroundColor: "black" }}>
            <Stack>
                <Stack.Screen
                    name="welcome"
                    options={{ ...newScreenOptions }}
                />
                <Stack.Screen
                    name="serviceSelection"
                    options={{ ...newScreenOptions }}
                />
                <Stack.Screen
                    name="end/color"
                    options={{ ...newScreenOptions }}
                    initialParams={{ accountId: "" }}
                />
                <Stack.Screen
                    name="auriga/method"
                    options={{ ...newScreenOptions }}
                />
                <Stack.Screen
                    name="auriga/method/microsoft"
                    options={{ ...newScreenOptions }}
                />
                <Stack.Screen
                    name="auriga/method/credentials"
                    options={{ ...newScreenOptions }}
                />
                <Stack.Screen
                    name="izly/credentials"
                    options={{ ...newScreenOptions }}
                    initialParams={{ url: "", previousPage: "map" }}
                />
            </Stack>
        </View>
    );
}