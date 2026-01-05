/* eslint-disable @typescript-eslint/no-require-imports */
import { useTheme } from '@react-navigation/native';
import { UnknownInputParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, ViewStyle } from 'react-native';

import { Services } from '@/stores/account/types';
export interface SupportedService {
  name: string;
  title: string;
  image?: NodeRequire;
  onPress: () => void;
  variant: string;
  color?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GetSupportedServices(redirect: (path: { pathname: string, options?: UnknownInputParams }) => void): SupportedService[] {
  const theme = useTheme();
  const { colors } = theme;
  const { t } = useTranslation()

  return [
    {
      name: "auriga",
      title: "Auriga",
      image: require("@/assets/images/auriga.png"),
      onPress: () => {
        redirect({ pathname: '../auriga/method', options: { color: "#0060D6" } });
      },
      variant: 'primary' as const,
      style: { backgroundColor: theme.dark ? colors.border : "black" },
    }
  ]
}

export interface AuthMethod {
  name: string;
  title: string;
  hasLimitedSupport: boolean;
  image?: NodeRequire;
  onPress: () => void;
}