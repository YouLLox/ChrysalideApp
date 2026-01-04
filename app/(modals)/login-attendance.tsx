
import React, { useRef, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';
import AbsencesAPI from "@/services/absences";
import { NativeHeaderPressable } from "@/ui/components/NativeHeader";
import { useTheme } from "@react-navigation/native";
import Typography from "@/ui/components/Typography";

const INJECTED_JAVASCRIPT = `
(function() {
  function sendToken(token, grades) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'LOGIN_SUCCESS',
      token: token.replace('Bearer ', ''),
      grades: grades
    }));
  }

  // Hook into XMLHttpRequest to intercept requests
  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url) {
      this._url = url;
      return originalOpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function() {
      var xhr = this;
      
      xhr.addEventListener('load', function() {
          try {
              if (xhr._url && xhr._url.toString().includes('grades')) {
                  var token = xhr.getResponseHeader('Authorization');
                  // Attempt to get token from request headers if not in response (it's usually in request)
                  // But XHR doesn't expose request headers easily. 
                  // However, if the response is the grades JSON, we are good.
                  
                  // Wait.. we need the TOKEN to make future requests. 
                  // The token is sent IN the request. We cannot easily see request headers in XHR proxy in browser JS 
                  // unless we override setRequestHeader.
              }
          } catch(e) {}
      });
      
      return originalSend.apply(this, arguments);
  };

  // We need to intercept setRequestHeader to capture the token
  var originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
      if (header.toLowerCase() === 'authorization') {
          this._auth_token = value;
      }
      return originalSetRequestHeader.apply(this, arguments);
  };

  // Enhance XHR listener to use the captured token
  var clsOpen = XMLHttpRequest.prototype.open;
  var clsSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return clsOpen.apply(this, arguments);
  }

  XMLHttpRequest.prototype.send = function() {
    var xhr = this;
    xhr.addEventListener('load', function() {
      if (xhr._url && xhr._url.toString().includes('grades')) {
        // If we have the token stored on the XHR object from setRequestHeader
        if (xhr._auth_token) {
           var response = xhr.responseText;
           try {
             var data = JSON.parse(response);
             sendToken(xhr._auth_token, data);
           } catch(e) {}
        }
      }
    });
    return clsSend.apply(this, arguments);
  }


  // Override fetch to intercept requests
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [resource, config] = args;
    
    // Proceed with the request
    const response = await originalFetch(...args);

    try {
      // Check if this is the grades request
      if (resource && resource.toString().includes('grades')) {
        
        let token = null;
        if (config && config.headers) {
          if (config.headers instanceof Headers) {
            token = config.headers.get('Authorization');
          } else {
             // Case insensitive search for authorization
             const authKey = Object.keys(config.headers).find(k => k.toLowerCase() === 'authorization');
             if (authKey) {
               token = config.headers[authKey];
             }
          }
        }

        // Clone response to read body
        const clone = response.clone();
        const data = await clone.json();

        if (token) {
          sendToken(token, data);
        }
      }
    } catch (err) {
      // Ignore errors
    }

    return response;
  };
})();
`;

export default function LoginAttendance() {
    const webviewRef = useRef<WebView>(null);
    const theme = useTheme();
    const { colors } = theme;
    const [loading, setLoading] = useState(true);

    const handleMessage = async (event: any) => {
        try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'LOGIN_SUCCESS') {
                const { token, grades } = message;

                // Save token
                AbsencesAPI.setToken(token);

                // Sync API (fetches fresh data and saves to DB)
                await AbsencesAPI.sync();

                // Go back
                router.back();
            }
        } catch (e) {
            console.error("Error handling webview message", e);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header for modal */}
            <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
                <NativeHeaderPressable onPress={() => router.back()}>
                    <Typography color="primary">Annuler</Typography>
                </NativeHeaderPressable>
                <Typography variant="h4">Connexion Absences</Typography>
                <View style={{ width: 50 }} />
            </View>

            <WebView
                ref={webviewRef}
                source={{ uri: 'https://absences.epita.net/' }}
                injectedJavaScript={INJECTED_JAVASCRIPT}
                onMessage={handleMessage}
                style={{ flex: 1 }}
                onLoadEnd={() => setLoading(false)}
                sharedCookiesEnabled={true}
                domStorageEnabled={true}
            />

            {loading && (
                <View style={StyleSheet.absoluteFillObject}>
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
