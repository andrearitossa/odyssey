import React, { ReactNode, useEffect, useRef } from "react";
import { AccessibilityInfo, Animated } from "react-native";

export function Reveal({ children }: { children: ReactNode }) {
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (reduced) => {
        if (reduced) {
          animation?.stop();
          progress.setValue(1);
        }
      },
    );
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) return;
      progress.setValue(0);
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      });
      animation.start();
    });
    return () => {
      active = false;
      animation?.stop();
      subscription.remove();
    };
  }, [progress]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
