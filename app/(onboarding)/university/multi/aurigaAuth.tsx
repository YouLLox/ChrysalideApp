
import { useTheme } from "@react-navigation/native";
import { Stack, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from 'react-native-webview';
import * as Crypto from 'expo-crypto';
import CookieManager from '@react-native-cookies/cookies';

import OnboardingBackButton from "@/components/onboarding/OnboardingBackButton";
import OnboardingWebview from "@/components/onboarding/OnboardingWebview";
import { useAlert } from "@/ui/components/AlertProvider";
import Button from "@/ui/components/Button";
import StackLayout from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import ViewContainer from "@/ui/components/ViewContainer";

import AurigaAPI from "@/services/auriga";
import { useAccountStore } from "@/stores/account";
import { Account, Services } from "@/stores/account/types";

// Standard Auriga login
const KEYCLOAK_AUTH_URL = "https://auriga.epita.fr";

// Success URL pattern 
const SUCCESS_URL_PATTERN = "auriga.epita.fr";

export default function AurigaLoginScreen() {
    const [showWebView, setShowWebView] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const webViewRef = useRef<WebView>(null);
    const alert = useAlert();
    const theme = useTheme();
    const { colors } = theme;
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { addAccount, setLastUsedAccount } = useAccountStore();

    // Injected JavaScript - minimal, just to keep session alive or debug
    const INJECTED_JAVASCRIPT = `
      true;
    `;

    const handleNavigationStateChange = async (navState: WebViewNavigation) => {
        const { url } = navState;
        console.log("WebView Nav:", url);

        // Check for success pattern
        if (url.includes(SUCCESS_URL_PATTERN) && !isSyncing) {
            // Check if we are past the login page likely (e.g. welcome, or just the base app loaded)
            if (url.includes("welcome") || url.endsWith("auriga.epita.fr/") || url.includes("#")) {
                await checkCookies(url);
            }
        }
    };

    const checkCookies = async (url: string) => {
        try {
            const cookies = await CookieManager.get(url);
            console.log("CookieManager Cookies:", cookies);

            // We look for any substantial cookie. Auriga likely uses JSESSIONID or similar.
            // CookieManager returns an object where keys are cookie names.
            const cookieString = Object.entries(cookies)
                .map(([key, value]) => `${key}=${value.value}`)
                .join('; ');

            if (cookieString && cookieString.length > 0) {
                setShowWebView(false);
                setIsSyncing(true);

                console.log("Captured Cookies:", cookieString);

                try {
                    AurigaAPI.setCookie(cookieString);

                    // Sync data
                    const { grades, syllabus } = await AurigaAPI.sync();

                    // Create Account
                    const accountId = Crypto.randomUUID();
                    const serviceId = Crypto.randomUUID();

                    const newAccount: Account = {
                        id: accountId,
                        firstName: "Etudiant",
                        lastName: "EPITA",
                        schoolName: "EPITA",
                        services: [
                            {
                                id: serviceId,
                                serviceId: Services.MULTI,
                                auth: {
                                    additionals: {
                                        type: 'auriga',
                                        cookies: cookieString
                                    }
                                },
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            }
                        ],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };

                    addAccount(newAccount);
                    setLastUsedAccount(accountId);

                    alert.showAlert({
                        title: "Connexion réussie",
                        description: "Tu es maintenant connecté à Auriga.",
                        icon: "Check",
                        color: "#00D600"
                    });

                    router.replace("/(tabs)");

                } catch (error) {
                    console.error("Auriga Sync Error:", error);
                    alert.showAlert({
                        title: "Erreur de synchronisation",
                        description: "Impossible de récupérer tes données Auriga.",
                        icon: "Error",
                        color: "#D60000"
                    });
                    setIsSyncing(false);
                    setShowWebView(true);
                }
            }
        } catch (error) {
            console.log("Error getting cookies:", error);
        }
    }

    const handleLogin = () => {
        setShowWebView(true);
    };

    if (isSyncing) {
        return (
            <ViewContainer>
                <StackLayout
                    vAlign="center"
                    hAlign="center"
                    style={{ flex: 1, backgroundColor: colors.background }}
                    gap={20}
                >
                    <ActivityIndicator size="large" color="#0078D4" />
                    <Typography variant="h3">Synchronisation...</Typography>
                    <Typography variant="body1" style={{ opacity: 0.7 }}>Récupération de tes données Auriga</Typography>
                </StackLayout>
            </ViewContainer>
        );
    }

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
                        injectedJavaScript: INJECTED_JAVASCRIPT,
                        sharedCookiesEnabled: true, // Crucial for CookieManager to see them
                        javaScriptEnabled: true,
                        domStorageEnabled: true,
                        thirdPartyCookiesEnabled: true,
                        incognito: false,
                        cacheEnabled: true,
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