import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Vibration, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors } from '../../theme';

export const ReorderContext = React.createContext<{
  dragGesture?: any;
  isActive?: boolean;
}>({});

export const useReorder = () => React.useContext(ReorderContext);

export interface ReorderableListProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  onReorder: (newData: T[]) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  renderItem: (info: {
    item: T;
    index: number;
    isActive: boolean;
    dragGesture: any;
  }) => React.ReactElement;
  style?: any;
}

interface ReorderableRowProps<T> {
  item: T;
  origIdx: number;
  id: string;
  activeId: SharedValue<string | null>;
  positions: SharedValue<number[]>;
  heights: SharedValue<number[]>;
  originalYs: SharedValue<number[]>;
  slotTops: SharedValue<number[]>;
  dragY: SharedValue<number>;
  activeInitialY: SharedValue<number>;
  startDrag: (origIdx: number, id: string) => void;
  updateDrag: (translationY: number) => void;
  endDrag: () => void;
  renderItem: ReorderableListProps<T>['renderItem'];
  onLayoutItem: (id: string, height: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

function ReorderableRow<T>({
  item,
  origIdx,
  id,
  activeId,
  positions,
  heights,
  originalYs,
  slotTops,
  dragY,
  activeInitialY,
  startDrag,
  updateDrag,
  endDrag,
  renderItem,
  onLayoutItem,
  onDragStart,
  onDragEnd,
}: ReorderableRowProps<T>) {
  const [hasMeasured, setHasMeasured] = useState(false);

  // Measure the item height on layout
  const handleLayout = (e: any) => {
    const measuredHeight = e.nativeEvent.layout.height;
    if (measuredHeight > 0) {
      onLayoutItem(id, measuredHeight);
      setHasMeasured(true);
    }
  };

  const triggerStartHaptic = () => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(20);
    }
  };

  const triggerScrollDisable = () => {
    if (onDragStart) onDragStart();
  };

  const triggerScrollEnable = () => {
    if (onDragEnd) onDragEnd();
  };

  // Immediate drag gesture (for the drag-handle)
  const handlePanGesture = React.useMemo(() => Gesture.Pan()
    .onBegin(() => {
      'worklet';
      runOnJS(triggerScrollDisable)();
    })
    .onStart(() => {
      'worklet';
      runOnJS(triggerStartHaptic)();
      startDrag(origIdx, id);
    })
    .onUpdate((e) => {
      'worklet';
      updateDrag(e.translationY);
    })
    .onEnd(() => {
      'worklet';
      endDrag();
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(triggerScrollEnable)();
    }),
    [origIdx, id, startDrag, updateDrag, endDrag]
  );

  // Delayed drag gesture (long press anywhere on the card)
  const cardPanGesture = React.useMemo(() => Gesture.Pan()
    .activateAfterLongPress(180)
    .onBegin(() => {
      'worklet';
      runOnJS(triggerScrollDisable)();
    })
    .onStart(() => {
      'worklet';
      runOnJS(triggerStartHaptic)();
      startDrag(origIdx, id);
    })
    .onUpdate((e) => {
      'worklet';
      updateDrag(e.translationY);
    })
    .onEnd(() => {
      'worklet';
      endDrag();
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(triggerScrollEnable)();
    }),
    [origIdx, id, startDrag, updateDrag, endDrag]
  );

  // Reanimated style to position the item on the UI thread
  const animatedStyle = useAnimatedStyle(() => {
    const isDragActive = activeId.value !== null;
    const isActive = activeId.value === id;

    if (isActive) {
      return {
        transform: [
          { translateY: dragY.value }
        ],
        zIndex: 999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 8,
        scale: 1.02,
      };
    }

    const slotIdx = positions.value[origIdx];
    if (slotIdx === undefined || !isDragActive) {
      return {
        transform: [{ translateY: 0 }],
        zIndex: 1,
      };
    }

    const targetY = slotTops.value[slotIdx] ?? 0;
    const originalY = originalYs.value[origIdx] ?? 0;
    const translateY = targetY - originalY;

    return {
      transform: [
        { translateY: withSpring(translateY, { damping: 26, stiffness: 300 }) }
      ],
      zIndex: 2,
    };
  });

  return (
    <GestureDetector gesture={cardPanGesture}>
      <Animated.View
        style={[styles.row, animatedStyle]}
        onLayout={handleLayout}
      >
        <ReorderContext.Provider value={{ dragGesture: handlePanGesture, isActive: activeId.value === id }}>
          {renderItem({
            item,
            index: origIdx,
            isActive: activeId.value === id,
            dragGesture: handlePanGesture,
          })}
        </ReorderContext.Provider>
      </Animated.View>
    </GestureDetector>
  );
}

export function ReorderableList<T>({
  data,
  keyExtractor,
  onReorder,
  onDragStart,
  onDragEnd,
  renderItem,
  style,
}: ReorderableListProps<T>) {
  const activeId = useSharedValue<string | null>(null);
  const dragY = useSharedValue(0);
  const activeInitialY = useSharedValue(0);

  const positions = useSharedValue<number[]>([]);
  const heights = useSharedValue<number[]>([]);
  const originalYs = useSharedValue<number[]>([]);
  const slotTops = useSharedValue<number[]>([]);

  const measuredHeights = useRef<Record<string, number>>({});
  const dataKeys = data.map(keyExtractor);
  const dataKeysStr = dataKeys.join(',');

  // Sync positions and heights when incoming data updates
  useEffect(() => {
    const N = data.length;
    positions.value = Array.from({ length: N }, (_, i) => i);
    heights.value = data.map(item => measuredHeights.current[keyExtractor(item)] || 0);
    
    // Reset drag state
    activeId.value = null;
    dragY.value = 0;
  }, [dataKeysStr]);

  const onLayoutItem = useCallback((id: string, height: number) => {
    measuredHeights.current[id] = height;
    
    // Sync heights shared value
    const N = data.length;
    const newHeights = [...heights.value];
    const index = data.findIndex(item => keyExtractor(item) === id);
    if (index !== -1 && index < N) {
      newHeights[index] = height;
      heights.value = newHeights;
    }
  }, [data, keyExtractor, heights]);

  const triggerSwapHaptic = () => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(10);
    }
  };

  const commitReorder = (newIndices: number[]) => {
    const reorderedData = newIndices.map(idx => data[idx]);
    onReorder(reorderedData);
  };

  const startDrag = useCallback((origIdx: number, id: string) => {
    'worklet';
    const N = heights.value.length;
    
    // Calculate original absolute Y positions
    const ys = new Array(N).fill(0);
    let accum = 0;
    for (let i = 0; i < N; i++) {
      ys[i] = accum;
      accum += (heights.value[i] || 0);
    }
    originalYs.value = ys;
    slotTops.value = ys;
    
    // Initialize positions
    const initPos = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      initPos[i] = i;
    }
    positions.value = initPos;

    activeId.value = id;
    dragY.value = 0;
    activeInitialY.value = ys[origIdx] || 0;
  }, [heights, originalYs, slotTops, positions, activeId, dragY, activeInitialY]);

  const updateDrag = useCallback((translationY: number) => {
    'worklet';
    if (activeId.value === null) return;

    const N = positions.value.length;
    
    // Find original index matching activeInitialY
    let activeOrig = -1;
    for (let i = 0; i < N; i++) {
      if (originalYs.value[i] === activeInitialY.value) {
        activeOrig = i;
        break;
      }
    }

    if (activeOrig === -1) return;

    dragY.value = translationY;

    let activeSlot = positions.value[activeOrig];
    let changed = true;
    let iteration = 0;

    while (changed && iteration < 10) {
      changed = false;
      iteration++;

      // Compute slotToOrig mapping
      const slotToOrig = new Array(N);
      for (let i = 0; i < N; i++) {
        slotToOrig[positions.value[i]] = i;
      }

      // Compute slot tops dynamically based on the current heights in those slots
      const tops = new Array(N).fill(0);
      let currentTop = 0;
      for (let s = 0; s < N; s++) {
        tops[s] = currentTop;
        const orig = slotToOrig[s];
        currentTop += (heights.value[orig] || 0);
      }

      const activeHeight = heights.value[activeOrig] || 0;
      const activeCenter = activeInitialY.value + dragY.value + activeHeight / 2;

      // Dragging down: check if active item center crossed the next slot midpoint
      if (activeSlot < N - 1) {
        const nextSlot = activeSlot + 1;
        const nextOrig = slotToOrig[nextSlot];
        const nextHeight = heights.value[nextOrig] || 0;
        const nextTop = tops[nextSlot];
        const nextCenter = nextTop + nextHeight / 2;

        if (activeCenter > nextCenter) {
          const newPos = [...positions.value];
          newPos[activeOrig] = nextSlot;
          newPos[nextOrig] = activeSlot;
          positions.value = newPos;
          activeSlot = nextSlot;
          
          // Recalculate slot tops
          const newTops = new Array(N).fill(0);
          let newAccum = 0;
          for (let s = 0; s < N; s++) {
            newTops[s] = newAccum;
            const o = s === activeSlot ? activeOrig : (s === nextSlot - 1 ? nextOrig : slotToOrig[s]);
            newAccum += (heights.value[o] || 0);
          }
          slotTops.value = newTops;

          runOnJS(triggerSwapHaptic)();
          changed = true;
          continue;
        }
      }

      // Dragging up: check if active item center crossed the previous slot midpoint
      if (activeSlot > 0) {
        const prevSlot = activeSlot - 1;
        const prevOrig = slotToOrig[prevSlot];
        const prevHeight = heights.value[prevOrig] || 0;
        const prevTop = tops[prevSlot];
        const prevCenter = prevTop + prevHeight / 2;

        if (activeCenter < prevCenter) {
          const newPos = [...positions.value];
          newPos[activeOrig] = prevSlot;
          newPos[prevOrig] = activeSlot;
          positions.value = newPos;
          activeSlot = prevSlot;

          // Recalculate slot tops
          const newTops = new Array(N).fill(0);
          let newAccum = 0;
          for (let s = 0; s < N; s++) {
            newTops[s] = newAccum;
            const o = s === activeSlot ? activeOrig : (s === prevSlot + 1 ? prevOrig : slotToOrig[s]);
            newAccum += (heights.value[o] || 0);
          }
          slotTops.value = newTops;

          runOnJS(triggerSwapHaptic)();
          changed = true;
          continue;
        }
      }
    }
  }, [activeId, positions, heights, originalYs, slotTops, activeInitialY, dragY]);

  const endDrag = useCallback(() => {
    'worklet';
    if (activeId.value === null) return;

    const N = positions.value.length;
    let activeOrig = -1;
    for (let i = 0; i < N; i++) {
      if (originalYs.value[i] === activeInitialY.value) {
        activeOrig = i;
        break;
      }
    }

    if (activeOrig === -1) {
      activeId.value = null;
      dragY.value = 0;
      return;
    }

    const finalSlot = positions.value[activeOrig];
    const targetY = slotTops.value[finalSlot] || 0;
    const originalY = originalYs.value[activeOrig] || 0;
    const targetTranslateY = targetY - originalY;

    // Build newIndices mapping
    const slotToOrig = new Array(N);
    for (let i = 0; i < N; i++) {
      slotToOrig[positions.value[i]] = i;
    }

    // Spring the active item into its final position on UI thread,
    // then commit the state change to JS thread.
    dragY.value = withSpring(targetTranslateY, { damping: 26, stiffness: 300 }, () => {
      'worklet';
      runOnJS(commitReorder)(slotToOrig);
    });
  }, [activeId, positions, originalYs, activeInitialY, slotTops, dragY]);

  return (
    <View style={[styles.container, style]}>
      {data.map((item, index) => {
        const id = keyExtractor(item);
        return (
          <ReorderableRow
            key={id}
            item={item}
            origIdx={index}
            id={id}
            activeId={activeId}
            positions={positions}
            heights={heights}
            originalYs={originalYs}
            slotTops={slotTops}
            dragY={dragY}
            activeInitialY={activeInitialY}
            startDrag={startDrag}
            updateDrag={updateDrag}
            endDrag={endDrag}
            renderItem={renderItem}
            onLayoutItem={onLayoutItem}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    width: '100%',
  },
});
