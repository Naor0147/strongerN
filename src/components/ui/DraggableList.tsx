import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  PanResponder,
  Animated,
  StyleSheet,
  Vibration,
  Platform,
} from 'react-native';

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
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Track Y position of each item by their key/ID
  const itemLayouts = useRef<{ [key: string]: { y: number; height: number } }>({});
  
  // Animated value for the translation of the dragged item
  const dragY = useRef(new Animated.Value(0)).current;
  
  // Keep track of the current index during dragging
  const dragIdx = useRef<number>(-1);
  const hoverIdx = useRef<number>(-1);

  useEffect(() => {
    if (!activeId) {
      setLocalData(data);
    }
  }, [data, activeId]);

  // Handle reordering while dragging
  const handleMove = (gestureStateY: number) => {
    if (dragIdx.current === -1 || !activeId) return;

    const currentLayout = itemLayouts.current[activeId];
    if (!currentLayout) return;

    // Estimate current Y center of the dragged item
    const currentCenterY = currentLayout.y + currentLayout.height / 2 + gestureStateY;

    // Check which item we are hovering over based on center positions
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
      // Reorder local state array visually
      const reordered = [...localData];
      const [movedItem] = reordered.splice(dragIdx.current, 1);
      reordered.splice(targetIndex, 0, movedItem);
      
      setLocalData(reordered);
      dragIdx.current = targetIndex;
      
      if (Platform.OS !== 'web') {
        Vibration.vibrate(10);
      }
    }
  };

  const getDragHandlers = (item: T, index: number) => {
    const id = keyExtractor(item);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setActiveId(id);
        dragIdx.current = index;
        hoverIdx.current = index;
        dragY.setValue(0);
        if (Platform.OS !== 'web') {
          Vibration.vibrate(20);
        }
      },
      onPanResponderMove: (e, gestureState) => {
        dragY.setValue(gestureState.dy);
        handleMove(gestureState.dy);
      },
      onPanResponderRelease: () => {
        const finalData = [...localData];
        setActiveId(null);
        dragIdx.current = -1;
        hoverIdx.current = -1;
        dragY.setValue(0);
        onDragEnd(finalData);
      },
      onPanResponderTerminate: () => {
        setActiveId(null);
        dragIdx.current = -1;
        hoverIdx.current = -1;
        dragY.setValue(0);
      },
    }).panHandlers;
  };

  return (
    <View style={styles.container}>
      {localData.map((item, index) => {
        const id = keyExtractor(item);
        const isActive = activeId === id;
        const dragHandlers = getDragHandlers(item, index);

        return (
          <Animated.View
            key={id}
            onLayout={(e) => {
              if (!isActive) {
                itemLayouts.current[id] = {
                  y: e.nativeEvent.layout.y,
                  height: e.nativeEvent.layout.height,
                };
              }
            }}
            style={[
              isActive && {
                transform: [{ translateY: dragY }],
                zIndex: 999,
                opacity: 0.85,
                backgroundColor: '#1E2633',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.45,
                shadowRadius: 10,
                elevation: 8,
              },
            ]}
          >
            {renderItem({ item, index, dragHandlers, isActive })}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
