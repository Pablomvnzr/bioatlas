import { Platform } from 'react-native';

export const colors = {
  background: '#FAF7F1',
  paper: '#FFFEFC',
  ink: '#35291F',
  muted: '#786557',
  green: '#2D503D',
  sage: '#E7EFE9',
  border: '#E9DED1',
  teal: '#286271',
  blue: '#EAF3F5',
  amber: '#9A5A16',
  amberLight: '#FCF1E4',
  red: '#A34235',
  redLight: '#FBEAE6',
};
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
