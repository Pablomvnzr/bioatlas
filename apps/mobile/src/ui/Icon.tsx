import React from 'react';
import { View } from 'react-native';
import { colors } from './theme';

// Small native line icons; no font download or extra runtime dependency.
export default function Icon({
  name,
  color = colors.green,
}: {
  name: 'map' | 'atlas' | 'community' | 'search';
  color?: string;
}) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}
    >
      {name === 'search' ? (
        <>
          <View
            style={{
              position: 'absolute',
              left: 3,
              top: 2,
              width: 16,
              height: 16,
              borderWidth: 2,
              borderColor: color,
              borderRadius: 9,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 18,
              top: 16,
              width: 2,
              height: 9,
              backgroundColor: color,
              transform: [{ rotate: '-45deg' }],
            }}
          />
        </>
      ) : name === 'community' ? (
        <>
          <View
            style={{
              width: 10,
              height: 10,
              borderWidth: 2,
              borderColor: color,
              borderRadius: 5,
              marginBottom: 3,
            }}
          />
          <View
            style={{
              width: 20,
              height: 10,
              borderWidth: 2,
              borderBottomWidth: 0,
              borderColor: color,
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
            }}
          />
        </>
      ) : (
        <View style={{ flexDirection: 'row' }}>
          {[0, 1, ...(name === 'map' ? [2] : [])].map((part) => (
            <View
              key={part}
              style={{
                width: name === 'map' ? 8 : 11,
                height: 19,
                borderWidth: 1.8,
                borderColor: color,
                borderRadius: name === 'atlas' ? 2 : 0,
                transform: [{ skewY: part % 2 ? '12deg' : '-12deg' }],
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
