import { useTheme } from "@react-navigation/native";
import { Stack, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from 'react-native-webview';

import OnboardingBackButton from "@/components/onboarding/OnboardingBackButton";
import OnboardingWebview from "@/components/onboarding/OnboardingWebview";
import { useAlert } from "@/ui/components/AlertProvider";
import Button from "@/ui/components/Button";
import StackLayout from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import ViewContainer from "@/ui/components/ViewContainer";

// Start with the Keycloak auth URL - this will handle the Microsoft redirect properly
const KEYCLOAK_AUTH_URL = "https://ionisepita-auth.np-auriga.nfrance.net/auth/realms/npionisepita/protocol/openid-connect/auth?client_id=np-front&redirect_uri=https%3A%2F%2Fauriga.epita.fr%2F%23%2FmainContent%2Fwelcome&response_mode=fragment&response_type=code&scope=openid&prompt=login";

// Success URL pattern to detect when auth is complete
const SUCCESS_URL_PATTERN = "auriga.epita.fr";

export default function AurigaLoginScreen() {
    const [showWebView, setShowWebView] = useState(false);
    const webViewRef = useRef<WebView>(null);
    const alert = useAlert();
    const theme = useTheme();
    const { colors } = theme;
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const handleNavigationStateChange = (navState: WebViewNavigation) => {
        const { url } = navState;

        // Check if we've been redirected back to Auriga (success)
        if (url.includes(SUCCESS_URL_PATTERN) && url.includes("code=")) {
            // Extract the auth code from the URL
            const codeMatch = url.match(/code=([^&]+)/);
            if (codeMatch) {
                setShowWebView(false);
                alert.showAlert({
                    title: "Connexion réussie",
                    description: "Tu es maintenant connecté à Auriga.",
                    icon: "Check",
                    color: "#00D600"
                });
                router.back();
            }
        }
    };

    const handleLogin = () => {
        setShowWebView(true);
    };

    if (showWebView) {
        return (
            <>
                <Stack.Screen options={{ headerShown: false }} />
                <OnboardingWebview
                    title="Connexion Microsoft"
                    color="#0078D4"
                    step={2}
                    totalSteps={2}
                    webViewRef={webViewRef}
                    webviewProps={{
                        source: { uri: KEYCLOAK_AUTH_URL },
                        onNavigationStateChange: handleNavigationStateChange,
                        javaScriptEnabled: true,
                        domStorageEnabled: true,
                        sharedCookiesEnabled: true,
                        thirdPartyCookiesEnabled: true,
                        incognito: false,
                        cacheEnabled: true,
                        keyboardDisplayRequiresUserAction: false,
                        allowsInlineMediaPlayback: true,
                        contentMode: "mobile",
                    }}
                />
            </>
        );
    }

    return (
        <ViewContainer>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                <StackLayout
                    padding={32}
                    backgroundColor="#0078D4"
                    gap={20}
                    style={{
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        borderBottomLeftRadius: 42,
                        borderBottomRightRadius: 42,
                        borderCurve: "continuous",
                        paddingTop: insets.top + 20,
                        paddingBottom: 40,
                        minHeight: 250,
                    }}
                >
                    <StackLayout vAlign="start" hAlign="start" width="100%" gap={6}>
                        <Typography
                            variant="h1"
                            style={{ color: "white", fontSize: 32, lineHeight: 34 }}
                        >
                            Connexion Microsoft
                        </Typography>
                        <Typography
                            variant="h5"
                            style={{ color: "#FFFFFF", lineHeight: 22, fontSize: 18 }}
                        >
                            Connecte-toi avec ton compte Microsoft EPITA pour accéder à Auriga.
                        </Typography>
                    </StackLayout>
                </StackLayout>

                <StackLayout
                    style={{
                        flex: 1,
                        padding: 20,
                        paddingBottom: insets.bottom + 20,
                        justifyContent: 'space-between',
                    }}
                    gap={16}
                >
                    <StackLayout gap={16}>
                        <Typography variant="body1" style={{ color: colors.text, opacity: 0.7, textAlign: 'center' }}>
                            Connecte-toi avec ton compte Microsoft EPITA.
                        </Typography>
                    </StackLayout>

                    <StackLayout gap={10}>
                        <Button
                            title="Se connecter"
                            onPress={handleLogin}
                            style={{ backgroundColor: "#0078D4" }}
                            size="large"
                        />
                    </StackLayout>
                </StackLayout>
            </View>

            <OnboardingBackButton />
        </ViewContainer>
    );
}