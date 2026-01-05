import { useTheme } from '@react-navigation/native';
import { RelativePathString, router, UnknownInputParams } from 'expo-router';
import { Papicons } from '@getpapillon/papicons';

import Typography from '@/ui/components/Typography';
import AnimatedPressable from '@/ui/components/AnimatedPressable';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';

import OnboardingScrollingFlatList from "@/components/onboarding/OnboardingScrollingFlatList";
import { SupportedAuthMethod } from "../utils/constants";

export function GetAurigaAuthMethod(redirect: (path: { pathname: string, options?: UnknownInputParams }) => void): SupportedAuthMethod[] {
  const theme = useTheme();
  const { colors } = theme;
  const { t } = useTranslation()

  return [
    {
        name: "microsoft",
        title: "Microsoft (Epita)",
        image: require("@/assets/images/microsoft.png"),
        onPress: () => {
          redirect({ pathname: '/auriga/method/microsoft', options: { color: "#0060D6" } });
        },
        hasLimitedSupport: false
    },
    {
        name: "credentials",
        title: "Email/Mot de Passe", // TODO: Traduction
        image: require("@/assets/images/auriga.png"),
        onPress: () => {
            redirect({ pathname: '/auriga/method/credentials', options: { color: "#0060D6" } });
        },
        hasLimitedSupport: false
    }
  ]
}

export default function WelcomeScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const { t } = useTranslation()

  const login_methods = GetAurigaAuthMethod((path: { pathname: string, options?: UnknownInputParams }) => {
        router.push({
          pathname: path.pathname as unknown as RelativePathString,
          params: path.options ?? {} as unknown as UnknownInputParams
        });
  });

  return (
    <OnboardingScrollingFlatList
      color={'#1E3035'}
      lottie={require('@/assets/lotties/auriga.json')}
      title={t("ONBOARDING_LOGIN_METHOD")}
      step={2}
      totalSteps={2}
      elements={login_methods}
      renderItem={({ item, index }) => (
        <Reanimated.View
          entering={FadeInDown.springify().duration(400).delay(index * 80 + 150)}
        >
          <AnimatedPressable
            onPress={() => {
              requestAnimationFrame(() => {
                (item as SupportedAuthMethod).onPress();
              });
            }}
            style={[
              {
                paddingHorizontal: 18,
                paddingVertical: 14,
                borderColor: colors.border,
                borderWidth: 1.5,
                borderRadius: 80,
                borderCurve: "continuous",
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                display: 'flex',
                gap: 16,
              }
            ]}
          >
            <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              {(item as SupportedAuthMethod).image && (
                <Image
                  source={(item as SupportedAuthMethod).image}
                  style={{ width: 32, height: 32 }}
                  resizeMode="cover"
                />
              )}
            </View>
            <Typography style={{ flex: 1 }} nowrap variant='title'>{(item as SupportedAuthMethod).title}</Typography>
          </AnimatedPressable>
        </Reanimated.View>
     )}
    />
  );
}