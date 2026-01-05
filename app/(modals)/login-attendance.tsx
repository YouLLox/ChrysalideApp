import { useTheme } from "@react-navigation/native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from 'react-native-webview';
import CookieManager from '@react-native-cookies/cookies';

import OnboardingBackButton from "@/components/onboarding/OnboardingBackButton";
import OnboardingWebview from "@/components/onboarding/OnboardingWebview";
import { useAlert } from "@/ui/components/AlertProvider";
import Button from "@/ui/components/Button";
import StackLayout from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import ViewContainer from "@/ui/components/ViewContainer";

import AbsencesAPI from "@/services/absences";

const ABSENCES_AUTH_URL = "https://absences.epita.net/";

export default function AttendanceLoginScreen() {
    const [showWebView, setShowWebView] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState("Récupération de tes absences");
    const webViewRef = useRef<WebView>(null);
    const alert = useAlert();
    const theme = useTheme();
    const { colors } = theme;
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const params = useLocalSearchParams();
    const isRefresh = params.refresh === "true";

    React.useEffect(() => {
        if (isRefresh) {
            setShowWebView(true);
            setHasInjected(false);
        }
    }, [isRefresh]);

    const [hasInjected, setHasInjected] = useState(false);

    const FETCH_TOKEN_SCRIPT = `
      (function() {
        function checkAndPost(data, source, url) {
            if (data && data.access_token) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'TOKEN',
                    payload: {
                        access_token: data.access_token,
                        source: source,
                        url: url
                    }
                }));
            }
             // Also check for 'token' field if access_token is missing
             else if (data && data.token) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'TOKEN',
                    payload: {
                        access_token: data.token, // Normalize to access_token
                        source: source,
                        url: url
                    }
                }));
            }
        }

        function isTargetUrl(url) {
            if (!url) return false;
            var s = url.toString();
            // Accept relative paths or same domain, exclude microsoft
            return (s.startsWith('/') || s.includes('absences.epita.net')) 
                && !s.includes('microsoft') 
                && !s.includes('live.com');
        }

        // 1. Intercept Fetch Requests (Headers)
        var originalFetch = window.fetch;
        window.fetch = function(url, options) {
            if (options && options.headers && options.headers.Authorization) {
                var val = options.headers.Authorization;
                if (isTargetUrl(url)) {
                     checkAndPost({ access_token: val.replace(/^Bearer /i, '') }, 'fetch-header', url.toString());
                }
            }
            return originalFetch.apply(this, arguments).then(function(response) {
                // 2. Intercept Fetch Responses (Body)
                try {
                    var clone = response.clone();
                    clone.json().then(function(data) {
                        if (isTargetUrl(response.url)) {
                            checkAndPost(data, 'fetch-response', response.url);
                        }
                    }).catch(function(){});
                } catch(e){}
                return response;
            });
        };

        // 3. Intercept XHR (Headers & Responses)
        var originalOpen = XMLHttpRequest.prototype.open;
        var originalSend = XMLHttpRequest.prototype.send;
        var originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

        XMLHttpRequest.prototype.open = function(method, url) {
            this._url = url;
            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
            if (header.toLowerCase() === 'authorization') {
                 if (isTargetUrl(this._url)) {
                    checkAndPost({ access_token: value.replace(/^Bearer /i, '') }, 'xhr-header', this._url);
                 }
            }
            return originalSetRequestHeader.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function() {
            var xhr = this;
            xhr.addEventListener('load', function() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (isTargetUrl(xhr._url)) {
                        checkAndPost(data, 'xhr-response', xhr._url);
                    }
                } catch(e) {}
            });
            return originalSend.apply(this, arguments);
        };

        // 4. Scrape Storage periodically
        setInterval(function() {
            // Check URL Hash & Search (Implicit Flow)
           try {
               var hash = window.location.hash;
               var search = window.location.search;
               if (hash.includes('access_token')) {
                   var params = new URLSearchParams(hash.substring(1)); // remove #
                   var at = params.get('access_token');
                   if (at) checkAndPost({ access_token: at }, 'url-hash', window.location.href);
               }
               if (search.includes('access_token')) {
                    var params = new URLSearchParams(search);
                    var at = params.get('access_token');
                    if (at) checkAndPost({ access_token: at }, 'url-query', window.location.href);
               }
           } catch(e){}

            // LocalStorage
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);
                    var val = localStorage.getItem(key);
                    // Check if value looks like a token or JSON containing token
                    if (key.includes('token') || key.includes('auth')) {
                         try {
                             var json = JSON.parse(val);
                             checkAndPost(json, 'localstorage-json-' + key);
                         } catch(e) { }
                    }
                }
                
                // SessionStorage
                 for (var i = 0; i < sessionStorage.length; i++) {
                    var key = sessionStorage.key(i);
                    var val = sessionStorage.getItem(key);
                     try {
                         var json = JSON.parse(val);
                         checkAndPost(json, 'sessionstorage-json-' + key);
                     } catch(e) {}
                }
            } catch(e) {}
        }, 1000);
        // 5. Explicit Fetch Helper
        window.fetchAbsencesData = function(token) {
            var endpoint = 'https://absences.epita.net/api/Users/student/grades';
            var headers = { 'Accept': 'application/json' };
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }
            
            fetch(endpoint, {
                headers: headers
            })
            .then(function(r) {
                if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
                return r.json();
            })
            .then(function(data) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'ABSENCES_DATA',
                    payload: data
                }));
            })
            .catch(function(e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'ABSENCES_ERROR',
                    payload: e.toString()
                }));
            });
        };
      })();
      true;
    `;

    const getCookiesString = async (url: string) => {
        try {
            const allCookies = await CookieManager.getAll(true);
            const relevantCookies: string[] = [];
            Object.values(allCookies).forEach((c: any) => {
                relevantCookies.push(`${c.name}=${c.value}`);
            });
            return relevantCookies.join('; ');
        } catch (e) {
            return "";
        }
    }

    const startSync = async (accessToken: string) => {
        if (isSyncing) return;
        setIsSyncing(true);
        setShowWebView(false);

        try {
            const cleanToken = accessToken.trim();
            AbsencesAPI.setToken(cleanToken);

            const cookies = await getCookiesString(ABSENCES_AUTH_URL);
            if (cookies) {
                console.log("Setting cookies for Absences API...");
                AbsencesAPI.setCookies(cookies);
            }

            setSyncStatus("Synchronisation des absences...");
            await AbsencesAPI.sync();

            alert.showAlert({
                title: "Connexion réussie",
                description: "Tu es maintenant connecté aux absences.",
                icon: "Check",
                color: "#00D600"
            });

            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace("/");
            }

        } catch (error) {
            console.error("Absences Sync Error:", error);
            alert.showAlert({
                title: "Erreur de synchronisation",
                description: "Impossible de récupérer tes absences.",
                icon: "Error",
                color: "#D60000"
            });
            setIsSyncing(false);
            setShowWebView(true);
        }
    };

    const handleNavigationStateChange = async (navState: WebViewNavigation) => {
        const { url } = navState;
        console.log("WebView Nav:", url);

        if (url && (url.includes('access_token=') || url.includes('id_token='))) {
            try {
                let tokenPart = '';
                if (url.includes('#')) tokenPart = url.split('#')[1];
                else if (url.includes('?')) tokenPart = url.split('?')[1];

                if (tokenPart) {
                    const params = new URLSearchParams(tokenPart);
                    const at = params.get('access_token') || params.get('id_token');
                    if (at) {
                        console.log("SUCCESS! Token found from Navigation URL");
                        const safeToken = at.trim();
                        AbsencesAPI.setToken(safeToken);

                        if (url.includes("absences.epita.net")) {
                            const injection = `window.fetchAbsencesData(${JSON.stringify(safeToken)}); true;`;
                            if (webViewRef.current) webViewRef.current.injectJavaScript(injection);
                            return;
                        }
                    }
                }
            } catch (e) { }
        }

        if (url.includes("absences.epita.net") && AbsencesAPI.getToken() && !isSyncing) {
            console.log("Landed on target origin with token. Triggering fetch...");
            setIsSyncing(true);
            setSyncStatus("Récupération des données...");

            const token = AbsencesAPI.getToken();
            const injection = `window.fetchAbsencesData(${JSON.stringify(token)}); true;`;
            if (webViewRef.current) {
                webViewRef.current.injectJavaScript(injection);
            }
        }

        if (!isSyncing && !hasInjected && !url.includes("login.microsoftonline.com")) {
            setHasInjected(true);
            if (webViewRef.current) {
                console.log("Injecting Token Interceptor...");
                webViewRef.current.injectJavaScript(FETCH_TOKEN_SCRIPT);
            }
        }
    };

    const handleMessage = async (event: any) => {
        try {
            const message = JSON.parse(event.nativeEvent.data);
            console.log("WebView Message:", message.type);

            if (message.type === 'TOKEN') {
                const tokenData = message.payload;
                if (tokenData && tokenData.access_token) {
                    if (isSyncing) return;

                    console.log("SUCCESS! Token found. Checking origin...");

                    const safeToken = tokenData.access_token.trim();
                    AbsencesAPI.setToken(safeToken);

                    const isCorrectOrigin = tokenData.url && tokenData.url.includes("absences.epita.net");

                    if (webViewRef.current && isCorrectOrigin) {
                        console.log("On correct origin. Fetching data...");
                        setIsSyncing(true);
                        setSyncStatus("Récupération des données...");

                        const injection = `window.fetchAbsencesData(${JSON.stringify(safeToken)}); true;`;
                        webViewRef.current.injectJavaScript(injection);
                    } else {
                        console.log("Token found on external origin (" + tokenData.url + "). Waiting for redirect...");
                    }
                }
            }
            else if (message.type === 'ABSENCES_DATA') {
                console.log("RECEIVED ABSENCES DATA FROM WEBVIEW!");
                await processAbsencesData(message.payload);
            }
            else if (message.type === 'ABSENCES_ERROR') {
                console.error("WebView Fetch Error:", message.payload);
                alert.showAlert({
                    title: "Erreur de récupération",
                    description: "Impossible de lire les données: " + message.payload,
                    icon: "Error",
                    color: "#D60000"
                });
            }
        } catch (e) {
            console.error("Failed to parse WebView message:", e);
        }
    };

    const processAbsencesData = async (data: any) => {

        setIsSyncing(true);
        setShowWebView(false);

        try {
            setSyncStatus("Traitement des données...");
            await AbsencesAPI.sync(data);

            alert.showAlert({
                title: "Connexion réussie",
                description: "Tes absences ont été synchronisées.",
                icon: "Check",
                color: "#00D600"
            });

            if (router.canGoBack()) {
                setIsSyncing(false);
                router.back();
            } else {
                setIsSyncing(false);
                router.replace("/");
            }
        } catch (error) {
            console.error("Absences Processing Error:", error);
            alert.showAlert({
                title: "Erreur de sauvegarde",
                description: "Impossible de sauvegarder tes absences.",
                icon: "Error",
                color: "#D60000"
            });
            setIsSyncing(false);
            setShowWebView(true);
        }
    }

    const handleLogin = () => {
        setShowWebView(true);
        setHasInjected(false);
    };

    return (
        <ViewContainer>
            <Stack.Screen options={{ headerShown: false }} />

            {isSyncing ? (
                <StackLayout vAlign="center" hAlign="center" style={{ flex: 1, backgroundColor: colors.background }} gap={20}>
                    <ActivityIndicator size="large" color="#0078D4" />
                    <Typography variant="h3">Synchronisation...</Typography>
                    <Typography variant="body1" style={{ opacity: 0.7 }}>{syncStatus}</Typography>
                </StackLayout>
            ) : showWebView ? (
                <OnboardingWebview
                    title="Connexion Absences"
                    color="#0078D4"
                    step={1}
                    totalSteps={1}
                    webViewRef={webViewRef}
                    webviewProps={{
                        source: { uri: ABSENCES_AUTH_URL },
                        onNavigationStateChange: handleNavigationStateChange,
                        onMessage: handleMessage,
                        injectedJavaScriptBeforeContentLoaded: FETCH_TOKEN_SCRIPT,
                        sharedCookiesEnabled: true,
                        javaScriptEnabled: true,
                        domStorageEnabled: true,
                        thirdPartyCookiesEnabled: true,
                        incognito: false,
                        cacheEnabled: true,
                    }}
                />
            ) : (
                <>
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
                                <Typography variant="h1" style={{ color: "white", fontSize: 32, lineHeight: 34 }}>
                                    Absences
                                </Typography>
                                <Typography variant="h5" style={{ color: "#FFFFFF", lineHeight: 22, fontSize: 18 }}>
                                    Connecte-toi avec ton compte Microsoft EPITA pour synchroniser tes absences.
                                </Typography>
                            </StackLayout>
                        </StackLayout>

                        <StackLayout
                            style={{ flex: 1, padding: 20, paddingBottom: insets.bottom + 20, justifyContent: 'space-between' }}
                            gap={16}
                        >
                            <StackLayout gap={16}>
                                <Typography variant="body1" style={{ color: colors.text, opacity: 0.7, textAlign: 'center' }}>
                                    Cela nous permettra de récupérer ton historique de présence.
                                </Typography>
                            </StackLayout>

                            <StackLayout gap={10}>
                                <Button title="Se connecter" onPress={handleLogin} style={{ backgroundColor: "#0078D4" }} size="large" />
                            </StackLayout>
                        </StackLayout>
                    </View>
                    <OnboardingBackButton />
                </>
            )}
        </ViewContainer>
    );
}
