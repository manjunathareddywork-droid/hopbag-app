import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { colors } from '@/theme';

type FeatherName = ComponentProps<typeof Feather>['name'];
type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Outline icons like the designs. Feather for most; a few from Material Community. */
const MCI: Record<string, MciName> = {
  cup: 'cup-outline',
  store: 'storefront-outline',
  shirt: 'tshirt-crew-outline',
  bank: 'bank-outline',
};

export type IconName = FeatherName | keyof typeof MCI;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 22, color = colors.text }: Props) {
  if (name in MCI) {
    return <MaterialCommunityIcons name={MCI[name]} size={size + 2} color={color} />;
  }
  return <Feather name={name as FeatherName} size={size} color={color} />;
}
