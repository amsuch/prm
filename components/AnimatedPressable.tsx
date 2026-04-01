import { Pressable, type PressableProps } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = { damping: 15, stiffness: 150, mass: 0.5 };

type AnimatedPressableProps = PressableProps & {
  scaleDown?: number;
  className?: string;
};

export function AnimatedPressable({
  scaleDown = 0.97,
  children,
  onPressIn,
  onPressOut,
  style,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressableBase
      onPressIn={(e) => {
        scale.value = withSpring(scaleDown, SPRING_CONFIG);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING_CONFIG);
        onPressOut?.(e);
      }}
      style={[animatedStyle, typeof style === "object" ? style : undefined]}
      {...props}
    >
      {children}
    </AnimatedPressableBase>
  );
}
