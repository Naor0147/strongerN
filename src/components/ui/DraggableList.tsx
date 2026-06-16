import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Vibration,
  Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

interface RenderItemWrapperProps<T> {
  renderItem: (info: { item: T; index: number; dragHandlers: any; isActive: boolean }) => React.ReactElement;
  item: T;
  index: number;
  dragHandlers: any;
  isActive: boolean;
}

function RenderItemWrapper<T>({
  renderItem,
  item,
  index,
  dragHandlers,
  isActive,
}: RenderItemWrapperProps<T>) {
  return renderItem({ item, index, dragHandlers, isActive });
}

interface DraggableListProps<T> {
  data: T[];
  renderItem: (info: { item: T; index: number; dragHandlers: any; isActive: boolean }) => React.ReactElement;
  onDragEnd: (newData: T[]) => void;
  keyExtractor: (item: T) => string;
}

export function DraggableList<T>({
  data,
  renderItem,
  onDragEnd,
  keyExtractor,
}: DraggableListProps<T>) {
  const [localData, setLocalData] = useState<T[]>(data);
  const prevDataRef = useRef<T[]>(data);
  const [activeId, setActiveId] = useState<string | null>(null);

  const itemLayouts = useRef<{ [key: string]: { y: number; height: number } }>({});
  const dragY = useSharedValue(0);
  const dragIdx = useRef<number>(-1);
  const hoverIdx = useRef<number>(-1);

  if (data !== prevDataRef.current) {
    if (!activeId) {
      setLocalData(data);
    }
    prevDataRef.current = data;
  }

  const handleMove = useCallback((gestureStateY: number) => {
    if (dragIdx.current === -1 || !activeId) return;

    const currentLayout = itemLayouts.current[activeId];
    if (!currentLayout) return;

    const currentCenterY = currentLayout.y + currentLayout.height / 2 + gestureStateY;
    let targetIndex = dragIdx.current;
    
    for (let i = 0; i < localData.length; i++) {
      const item = localData[i];
      const key = keyExtractor(item);
      const layout = itemLayouts.current[key];
      if (layout && key !== activeId) {
        if (i < dragIdx.current && currentCenterY < layout.y + layout.height) {
          targetIndex = i;
          break;
        }
        if (i > dragIdx.current && currentCenterY > layout.y) {
          targetIndex = i;
        }
      }
    }

    if (targetIndex !== hoverIdx.current) {
      hoverIdx.current = targetIndex;
      const reordered = [...localData];
      const [movedItem] = reordered.splice(dragIdx.current, 1);
      reordered.splice(targetIndex, 0, movedItem);
      
      setLocalData(reordered);
      dragIdx.current = targetIndex;
      
      if (Platform.OS !== 'web') {
        Vibration.vibrate(10);
      }
    }
  }, [activeId, localData, keyExtractor]);

  const getDragHandlers = useCallback((item: T, index: number) => {
    const id = keyExtractor(item);
    const panGesture = Gesture.Pan()
      .onStart(() => {
        setActiveId(id);
        dragIdx.current = index;
        hoverIdx.current = index;
        dragY.value = 0;
        if (Platform.OS !== 'web') {
          Vibration.vibrate(20);
        }
      })
      .onUpdate((e) => {
        dragY.value = e.translationY;
        handleMove(e.translationY);
      })
      .onEnd(() => {
        const finalData = [...localData];
        setActiveId(null);
        dragIdx.current = -1;
        hoverIdx.current = -1;
        dragY.value = 0;
        onDragEnd(finalData);
      })
      .onFinalize(() => {
        setActiveId(null);
        dragIdx.current = -1;
        hoverIdx.current = -1;
        dragY.value = 0;
      });

    return { panGesture };
  }, [handleMove, localData, keyExtractor, onDragEnd]);

  return (
    <View style={styles.container}>
      {localData.map((item, index) => {
        const id = keyExtractor(item);
        const isActive = activeId === id;
        const { panGesture } = getDragHandlers(item, index);

        const DragItem = () => {
          const animatedStyle = useAnimatedStyle(() => ({
            transform: [{ translateY: dragY.value }],
          }));

          return (
            <Animated.View
              onLayout={(e) => {
                if (!isActive) {
                  itemLayouts.current[id] = {
                    y: e.nativeEvent.layout.y,
                    height: e.nativeEvent.layout.height,
                  };
                }
              }}
              style={isActive ? [
                {
                  zIndex: 999,
                  opacity: 0.85,
                  backgroundColor: '#1E2633',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.45,
                  shadowRadius: 10,
                  elevation: 8,
                },
                animatedStyle,
              ] : undefined}
            >
              <View>
                <RenderItemWrapper
                  renderItem={renderItem}
                  item={item}
                  index={index}
                  dragHandlers={{ panGesture }}
                  isActive={isActive}
                />
              </View>
            </Animated.View>
          );
        };

        return <DragItem key={id} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
