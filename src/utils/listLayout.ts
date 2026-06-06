// utils/listLayout.ts

interface SectionLayoutProps {
  getItemHeight: (sectionIndex: number, itemIndex: number) => number;
  getSectionHeaderHeight?: (sectionIndex: number) => number;
  getSectionFooterHeight?: (sectionIndex: number) => number;
}

/**
 * Manually computes the layout structure for SectionList items, headers, and footers.
 * This replaces react-native-section-list-get-item-layout with zero dependencies.
 */
export function sectionListGetItemLayout(props: SectionLayoutProps) {
  return (data: any[] | null, index: number) => {
    let offset = 0;
    let currentIndex = 0;

    if (!data) {
      return { length: 0, offset: 0, index };
    }

    for (let sectionIndex = 0; sectionIndex < data.length; sectionIndex++) {
      // 1. Section Header Layout
      const headerHeight = props.getSectionHeaderHeight ? props.getSectionHeaderHeight(sectionIndex) : 0;
      if (currentIndex === index) {
        return { length: headerHeight, offset, index };
      }
      offset += headerHeight;
      currentIndex++;

      // 2. Section Items Layout
      const section = data[sectionIndex];
      const itemsCount = section.data ? section.data.length : 0;
      for (let itemIndex = 0; itemIndex < itemsCount; itemIndex++) {
        const itemHeight = props.getItemHeight(sectionIndex, itemIndex);
        if (currentIndex === index) {
          return { length: itemHeight, offset, index };
        }
        offset += itemHeight;
        currentIndex++;
      }

      // 3. Section Footer Layout
      const footerHeight = props.getSectionFooterHeight ? props.getSectionFooterHeight(sectionIndex) : 0;
      if (currentIndex === index) {
        return { length: footerHeight, offset, index };
      }
      offset += footerHeight;
      currentIndex++;
    }

    return { length: 0, offset, index };
  };
}
