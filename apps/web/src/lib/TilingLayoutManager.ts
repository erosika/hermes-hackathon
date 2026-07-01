/**
 * Tiling Layout Manager inspired by Hyprland/i3/bspwm
 * Manages automatic window positioning and tiling layouts
 */

export type LayoutMode = 'tiled' | 'stacked' | 'monocle' | 'floating'
export type SplitDirection = 'horizontal' | 'vertical'

export interface TiledWindow {
  id: number
  isMinimized?: boolean
  isFloating?: boolean
  isMaximized?: boolean
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  minimizeType?: 'vertical' | 'horizontal' // How the window should collapse when minimized
}

export interface LayoutConfig {
  mode: LayoutMode
  masterRatio: number // 0-1, how much space the master window takes
  gaps: {
    inner: number // Gap between windows
    outer: number // Gap from screen edges
  }
  topBarHeight: number // Height of status bar
  maxWindowWidth?: number // Maximum width for any window (optional constraint)
}

const DEFAULT_CONFIG: LayoutConfig = {
  mode: 'tiled',
  masterRatio: 0.55,
  gaps: {
    inner: 8,
    outer: 8,
  },
  topBarHeight: 32,
  maxWindowWidth: undefined, // No max width by default
}

export class TilingLayoutManager {
  private config: LayoutConfig

  constructor(config?: Partial<LayoutConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Apply maximum width constraint to a set of window bounds
   * Centers windows that exceed the max width
   * Note: containerWidth should already have widget space subtracted by Desktop.tsx
   */
  private applyMaxWidthConstraint(
    positions: Map<number, WindowBounds>,
    containerWidth: number
  ): Map<number, WindowBounds> {
    if (!this.config.maxWindowWidth) {
      return positions
    }

    const maxWidth = Math.min(
      this.config.maxWindowWidth,
      containerWidth - this.config.gaps.outer * 2
    )

    const constrainedPositions = new Map<number, WindowBounds>()

    positions.forEach((bounds, id) => {
      if (bounds.width > maxWidth) {
        // Constrain width and center horizontally within available container
        const offsetX = (containerWidth - maxWidth) / 2
        constrainedPositions.set(id, {
          ...bounds,
          x: offsetX,
          width: maxWidth,
        })
      } else {
        constrainedPositions.set(id, bounds)
      }
    })

    return constrainedPositions
  }

  /**
   * Calculate window positions based on the current layout mode
   */
  calculateLayout(
    windows: TiledWindow[],
    containerWidth: number,
    containerHeight: number
  ): Map<number, WindowBounds> {
    const allWindows = windows.filter((w) => !w.isFloating)
    let positions = new Map<number, WindowBounds>()

    if (allWindows.length === 0) {
      return positions
    }

    const usableHeight = containerHeight - this.config.topBarHeight
    const startY = this.config.topBarHeight
    const { inner, outer } = this.config.gaps
    const MINIMIZED_VERTICAL_WIDTH = 48

    // Check if any window is maximized
    const maximizedWindowIndex = allWindows.findIndex((w) => w.isMaximized)
    if (maximizedWindowIndex !== -1) {
      const maximizedWindow = allWindows[maximizedWindowIndex]!

      // Windows before the maximized window go on the left (should be minimized)
      const windowsBefore = allWindows.slice(0, maximizedWindowIndex)
      // Windows after the maximized window go on the right (should be minimized)
      const windowsAfter = allWindows.slice(maximizedWindowIndex + 1)

      // Calculate space needed for minimized windows (they should all be minimized)
      const leftBarsCount = windowsBefore.length
      const rightBarsCount = windowsAfter.length
      const totalBarsCount = leftBarsCount + rightBarsCount
      const totalGaps = totalBarsCount > 0 ? totalBarsCount + 1 : 0 // gaps before, between, and after bars
      const totalBarsWidth =
        totalBarsCount * MINIMIZED_VERTICAL_WIDTH + totalGaps * inner

      // Calculate maximized window width
      const maximizedWidth = containerWidth - outer * 2 - totalBarsWidth

      // Place windows before maximized window on the left
      let currentX = outer
      windowsBefore.forEach((window) => {
        positions.set(window.id, {
          x: currentX,
          y: startY + outer,
          width: MINIMIZED_VERTICAL_WIDTH,
          height: usableHeight - outer * 2,
          minimizeType: 'vertical',
        })
        currentX += MINIMIZED_VERTICAL_WIDTH + inner
      })

      // Maximized window in the middle
      const maximizedX = currentX
      positions.set(maximizedWindow.id, {
        x: maximizedX,
        y: startY + outer,
        width: maximizedWidth,
        height: usableHeight - outer * 2,
      })

      // Place windows after maximized window on the right
      currentX = maximizedX + maximizedWidth + inner
      windowsAfter.forEach((window) => {
        positions.set(window.id, {
          x: currentX,
          y: startY + outer,
          width: MINIMIZED_VERTICAL_WIDTH,
          height: usableHeight - outer * 2,
          minimizeType: 'vertical',
        })
        currentX += MINIMIZED_VERTICAL_WIDTH + inner
      })

      // Apply maximum width constraint for maximized window layout
      return this.applyMaxWidthConstraint(positions, containerWidth)
    }

    switch (this.config.mode) {
      case 'tiled':
        positions = this.tiledLayoutWithMinimized(
          allWindows,
          containerWidth,
          usableHeight,
          startY
        )
        break
      case 'stacked':
        positions = this.stackedLayoutWithMinimized(
          allWindows,
          containerWidth,
          usableHeight,
          startY
        )
        break
      case 'monocle':
        positions = this.monocleLayout(
          allWindows.filter((w) => !w.isMinimized),
          containerWidth,
          usableHeight,
          startY
        )
        break
      case 'floating':
        // Floating windows manage their own position
        break
      default:
        positions = this.tiledLayoutWithMinimized(
          allWindows,
          containerWidth,
          usableHeight,
          startY
        )
        break
    }

    // Apply maximum width constraint before returning
    return this.applyMaxWidthConstraint(positions, containerWidth)
  }

  /**
   * Tiled layout with minimized windows - master window on left, stack on right
   */
  private tiledLayoutWithMinimized(
    windows: TiledWindow[],
    width: number,
    height: number,
    startY: number
  ): Map<number, WindowBounds> {
    const positions = new Map<number, WindowBounds>()
    const { inner, outer } = this.config.gaps
    const MINIMIZED_VERTICAL_WIDTH = 48
    const MINIMIZED_HORIZONTAL_HEIGHT = 40

    if (windows.length === 0) {
      return positions
    }

    if (windows.length === 1) {
      const win = windows[0]!
      if (win.isMinimized) {
        // Single window minimized → vertical bar
        positions.set(win.id, {
          x: outer,
          y: startY + outer,
          width: MINIMIZED_VERTICAL_WIDTH,
          height: height - outer * 2,
          minimizeType: 'vertical',
        })
      } else {
        // Single window takes full space
        positions.set(win.id, {
          x: outer,
          y: startY + outer,
          width: width - outer * 2,
          height: height - outer * 2,
        })
      }
      return positions
    }

    // Special case: exactly 2 windows
    if (windows.length === 2) {
      const masterWindow = windows[0]!
      const stackWindow = windows[1]!
      const isMasterMinimized = masterWindow.isMinimized
      const isStackMinimized = stackWindow.isMinimized

      // If master is minimized: both become vertical bars
      if (isMasterMinimized) {
        const win1Width = MINIMIZED_VERTICAL_WIDTH
        const win2Width = isStackMinimized
          ? MINIMIZED_VERTICAL_WIDTH
          : width - outer * 2 - inner - win1Width

        positions.set(masterWindow.id, {
          x: outer,
          y: startY + outer,
          width: win1Width,
          height: height - outer * 2,
          minimizeType: 'vertical',
        })

        positions.set(stackWindow.id, {
          x: outer + win1Width + inner,
          y: startY + outer,
          width: win2Width,
          height: height - outer * 2,
          minimizeType: 'vertical',
        })

        return positions
      }

      // Master is expanded
      if (isStackMinimized) {
        // Stack window minimized: vertical bar on the right, master takes most space
        const stackWidth = MINIMIZED_VERTICAL_WIDTH
        const masterWidth = width - outer * 2 - inner - stackWidth

        positions.set(masterWindow.id, {
          x: outer,
          y: startY + outer,
          width: masterWidth,
          height: height - outer * 2,
          minimizeType: 'vertical',
        })

        positions.set(stackWindow.id, {
          x: outer + masterWidth + inner,
          y: startY + outer,
          width: stackWidth,
          height: height - outer * 2,
          minimizeType: 'vertical',
        })
      } else {
        // Both windows expanded: split 50/50
        const masterWidth = Math.floor((width - outer * 2 - inner) / 2)
        const stackWidth = width - outer * 2 - inner - masterWidth

        positions.set(masterWindow.id, {
          x: outer,
          y: startY + outer,
          width: masterWidth,
          height: height - outer * 2,
          minimizeType: 'vertical',
        })

        positions.set(stackWindow.id, {
          x: outer + masterWidth + inner,
          y: startY + outer,
          width: stackWidth,
          height: height - outer * 2,
        })
      }

      return positions
    }

    // Master-stack layout with 3+ windows
    const masterWindow = windows[0]!
    const stackWindows = windows.slice(1)

    // Count minimized windows
    const isMasterMinimized = masterWindow.isMinimized
    const minimizedStackCount = stackWindows.filter((w) => w.isMinimized).length
    const visibleStackCount = stackWindows.filter((w) => !w.isMinimized).length

    // Determine collapse type:
    // - Master expanded + some stack windows expanded: minimized stack windows use horizontal bars
    // - Master expanded + all stack windows minimized: all use vertical bars (full-width master mode)
    // - Master minimized: all minimized windows become vertical bars
    const useHorizontalCollapse =
      !isMasterMinimized && minimizedStackCount > 0 && visibleStackCount > 0

    // Calculate master width
    let masterWidth: number
    if (isMasterMinimized) {
      // Master minimized: shrink to vertical bar
      masterWidth = MINIMIZED_VERTICAL_WIDTH
    } else if (
      minimizedStackCount === stackWindows.length &&
      minimizedStackCount > 0
    ) {
      // Master expanded AND all stack windows are minimized: master takes all space except minimized bars
      const totalMinimizedWidth = minimizedStackCount * MINIMIZED_VERTICAL_WIDTH
      const totalGaps = minimizedStackCount * inner // gaps between minimized windows and master
      masterWidth = width - totalMinimizedWidth - totalGaps - outer * 2
    } else {
      // Master expanded with some expanded stack windows: use master ratio
      masterWidth =
        Math.floor(width * this.config.masterRatio) - outer - inner / 2
    }

    // Calculate stack area width
    const stackAreaWidth = width - masterWidth - outer * 2 - inner

    // Position master window
    positions.set(masterWindow.id, {
      x: outer,
      y: startY + outer,
      width: masterWidth,
      height: height - outer * 2,
      minimizeType: 'vertical',
    })

    // Handle stack windows based on collapse type
    if (useHorizontalCollapse) {
      // Split stack windows: middle column vs far right vertical bars
      // Rule: Find the last expanded window. All minimized windows after it become vertical bars on the right.
      let lastExpandedIndex = -1
      for (let i = stackWindows.length - 1; i >= 0; i--) {
        if (!stackWindows[i]!.isMinimized) {
          lastExpandedIndex = i
          break
        }
      }

      const middleStackWindows = lastExpandedIndex >= 0
        ? stackWindows.slice(0, lastExpandedIndex + 1)
        : []
      const rightVerticalBars = lastExpandedIndex >= 0
        ? stackWindows.slice(lastExpandedIndex + 1)
        : stackWindows

      // Calculate space for right vertical bars (includes gap after each bar for spacing)
      const rightBarsWidth = rightVerticalBars.length > 0
        ? rightVerticalBars.length * (MINIMIZED_VERTICAL_WIDTH + inner)
        : 0

      // Available width for middle stack column
      const middleStackWidth = stackAreaWidth - rightBarsWidth

      // Calculate dimensions for middle stack column
      const middleStackMinimized = middleStackWindows.filter(w => w.isMinimized).length
      const middleStackExpanded = middleStackWindows.filter(w => !w.isMinimized).length
      const minimizedStackHeight = middleStackMinimized * MINIMIZED_HORIZONTAL_HEIGHT
      const availableStackHeight =
        height -
        outer * 2 -
        minimizedStackHeight -
        (middleStackWindows.length > 0 ? (middleStackWindows.length - 1) * inner : 0)
      const visibleStackWindowHeight =
        middleStackExpanded > 0
          ? Math.floor(availableStackHeight / middleStackExpanded)
          : 0

      // Place middle stack windows
      let currentY = startY + outer
      let expandedCount = 0
      middleStackWindows.forEach((window, index) => {
        if (window.isMinimized) {
          positions.set(window.id, {
            x: masterWidth + outer + inner,
            y: currentY,
            width: middleStackWidth,
            height: MINIMIZED_HORIZONTAL_HEIGHT,
            minimizeType: 'horizontal',
          })
          currentY += MINIMIZED_HORIZONTAL_HEIGHT + inner
        } else {
          expandedCount++
          const isLast = expandedCount === middleStackExpanded
          const thisHeight = isLast
            ? height - outer * 2 - (currentY - startY - outer)
            : visibleStackWindowHeight

          positions.set(window.id, {
            x: masterWidth + outer + inner,
            y: currentY,
            width: middleStackWidth,
            height: thisHeight,
          })
          currentY += thisHeight + inner
        }
      })

      // Place right vertical bars (trailing minimized windows)
      let currentX = masterWidth + outer + inner + middleStackWidth + inner
      rightVerticalBars.forEach((window) => {
        positions.set(window.id, {
          x: currentX,
          y: startY + outer,
          width: MINIMIZED_VERTICAL_WIDTH,
          height: height - outer * 2,
          minimizeType: 'vertical',
        })
        currentX += MINIMIZED_VERTICAL_WIDTH + inner
      })
    } else {
      // Use vertical collapse for 3+ minimized or when master is minimized
      // If all stack windows are minimized, distribute vertical bars evenly
      if (visibleStackCount === 0 && minimizedStackCount > 0) {
        const barWidth = MINIMIZED_VERTICAL_WIDTH
        let currentX = masterWidth + outer + inner

        stackWindows.forEach((window) => {
          if (window.isMinimized) {
            positions.set(window.id, {
              x: currentX,
              y: startY + outer,
              width: barWidth,
              height: height - outer * 2,
              minimizeType: 'vertical',
            })
            currentX += barWidth + inner
          }
        })
      } else if (isMasterMinimized && visibleStackCount >= 2) {
        // Master minimized + 2+ expanded stack windows: use sub-master layout
        // Windows 1-2 when minimized: vertical bars on the left
        // Windows 3-5: first expanded becomes sub-master, minimized use horizontal bars
        // Windows 6+: vertical bars on the right

        const secondWindow = stackWindows[0] // Window 2 (first stack window)
        const remainingWindows = stackWindows.slice(1) // Windows 3+ (stack indices 1+)
        const layoutWindows = stackWindows.slice(0, 4) // Windows 2-5 (first 4 stack windows)
        const extraWindows = stackWindows.slice(4) // Windows 6+ (stack indices 4+)

        // Track which windows go where
        let leftVerticalBars: TiledWindow[] = []
        let subMasterWindow: TiledWindow | null = null
        let rightColumnWindows: TiledWindow[] = []

        // Window 2: if minimized, goes to left vertical bars; if expanded, becomes sub-master
        if (secondWindow) {
          if (secondWindow.isMinimized) {
            leftVerticalBars.push(secondWindow)
            // Find sub-master from windows 3-5
            for (const window of remainingWindows.slice(0, 3)) {
              if (!window.isMinimized) {
                subMasterWindow = window
                break
              }
            }
            // Remaining windows 3-5 go to right column (excluding sub-master)
            rightColumnWindows = remainingWindows.slice(0, 3).filter(w => w !== subMasterWindow)
          } else {
            // Window 2 is sub-master
            subMasterWindow = secondWindow
            // Windows 3-5 go to right column
            rightColumnWindows = remainingWindows.slice(0, 3)
          }
        }

        // Split right column windows: middle column vs far right vertical bars
        // Rule: Find the last expanded window. All minimized windows after it become vertical bars on the right.
        let lastExpandedIndex = -1
        for (let i = rightColumnWindows.length - 1; i >= 0; i--) {
          if (!rightColumnWindows[i]!.isMinimized) {
            lastExpandedIndex = i
            break
          }
        }

        const middleColumnWindows = lastExpandedIndex >= 0
          ? rightColumnWindows.slice(0, lastExpandedIndex + 1)
          : []
        const rightVerticalBars = lastExpandedIndex >= 0
          ? rightColumnWindows.slice(lastExpandedIndex + 1)
          : rightColumnWindows

        // Calculate space for left vertical bars, right vertical bars, and extra windows
        // (includes gap after each bar for spacing between sections)
        const leftBarsWidth = leftVerticalBars.length > 0
          ? leftVerticalBars.length * (MINIMIZED_VERTICAL_WIDTH + inner)
          : 0
        const rightBarsWidth = rightVerticalBars.length > 0
          ? rightVerticalBars.length * (MINIMIZED_VERTICAL_WIDTH + inner)
          : 0
        const extraWindowsWidth = extraWindows.length > 0
          ? extraWindows.length * (MINIMIZED_VERTICAL_WIDTH + inner)
          : 0

        // Available space for sub-master and middle column (excluding left bars, right bars, and extra windows)
        const layoutAreaWidth = stackAreaWidth - leftBarsWidth - rightBarsWidth - extraWindowsWidth
        const subMasterWidth = Math.floor(layoutAreaWidth * 0.6)
        const middleColumnWidth = layoutAreaWidth - subMasterWidth - inner

        // Calculate dimensions for middle column
        const middleColumnMinimized = middleColumnWindows.filter(w => w.isMinimized).length
        const middleColumnExpanded = middleColumnWindows.filter(w => !w.isMinimized).length
        const middleColumnMinimizedHeight = middleColumnMinimized * MINIMIZED_HORIZONTAL_HEIGHT
        const middleColumnGaps = middleColumnWindows.length > 0 ? (middleColumnWindows.length - 1) * inner : 0
        const availableVerticalHeight = height - outer * 2 - middleColumnMinimizedHeight - middleColumnGaps
        const expandedHeight = middleColumnExpanded > 0
          ? Math.floor(availableVerticalHeight / middleColumnExpanded)
          : 0

        // Place left vertical bars (windows 1-2 when minimized)
        let currentX = masterWidth + outer + inner
        leftVerticalBars.forEach((window) => {
          positions.set(window.id, {
            x: currentX,
            y: startY + outer,
            width: MINIMIZED_VERTICAL_WIDTH,
            height: height - outer * 2,
            minimizeType: 'vertical',
          })
          currentX += MINIMIZED_VERTICAL_WIDTH + inner
        })

        // Place sub-master
        const subMasterX = currentX
        const middleColumnX = subMasterX + subMasterWidth + inner

        if (subMasterWindow) {
          positions.set(subMasterWindow.id, {
            x: subMasterX,
            y: startY + outer,
            width: subMasterWidth,
            height: height - outer * 2,
          })
        }

        // Place middle column windows (windows 3-5 up to last expanded, excluding sub-master)
        let middleColumnY = startY + outer
        let expandedCount = 0

        middleColumnWindows.forEach((window) => {
          if (window.isMinimized) {
            // Minimized: horizontal bar
            positions.set(window.id, {
              x: middleColumnX,
              y: middleColumnY,
              width: middleColumnWidth,
              height: MINIMIZED_HORIZONTAL_HEIGHT,
              minimizeType: 'horizontal',
            })
            middleColumnY += MINIMIZED_HORIZONTAL_HEIGHT + inner
          } else {
            // Expanded: stacked vertically
            expandedCount++
            const isLast = expandedCount === middleColumnExpanded
            const thisHeight = isLast
              ? height - outer * 2 - (middleColumnY - startY - outer)
              : expandedHeight

            positions.set(window.id, {
              x: middleColumnX,
              y: middleColumnY,
              width: middleColumnWidth,
              height: thisHeight,
            })
            middleColumnY += thisHeight + inner
          }
        })

        // Place right vertical bars (trailing minimized windows from 3-5)
        currentX = middleColumnX + middleColumnWidth + inner
        rightVerticalBars.forEach((window) => {
          positions.set(window.id, {
            x: currentX,
            y: startY + outer,
            width: MINIMIZED_VERTICAL_WIDTH,
            height: height - outer * 2,
            minimizeType: 'vertical',
          })
          currentX += MINIMIZED_VERTICAL_WIDTH + inner
        })

        // Place extra windows (6+) as vertical bars at the far right
        if (extraWindows.length > 0) {
          extraWindows.forEach((window) => {
            positions.set(window.id, {
              x: currentX,
              y: startY + outer,
              width: MINIMIZED_VERTICAL_WIDTH,
              height: height - outer * 2,
              minimizeType: 'vertical',
            })
            currentX += MINIMIZED_VERTICAL_WIDTH + inner
          })
        }
      } else if (
        !isMasterMinimized &&
        minimizedStackCount === 0 &&
        visibleStackCount >= 1
      ) {
        // Master expanded, no minimized windows: stack all windows vertically
        const stackWindowHeight = Math.floor(
          (height - outer * 2 - inner * (visibleStackCount - 1)) /
            visibleStackCount
        )
        let currentY = startY + outer

        stackWindows.forEach((window, index) => {
          const isLast = index === stackWindows.length - 1
          const thisHeight = isLast
            ? height - outer * 2 - (currentY - startY - outer)
            : stackWindowHeight

          positions.set(window.id, {
            x: masterWidth + outer + inner,
            y: currentY,
            width: stackAreaWidth,
            height: thisHeight,
          })
          currentY += thisHeight + inner
        })
      } else {
        // Any number of expanded stack windows with minimized bars: maintain exact order
        let currentX = masterWidth + outer + inner

        // First pass: calculate positions of expanded windows to know their widths
        const expandedIndices: number[] = []
        stackWindows.forEach((window, index) => {
          if (!window.isMinimized) {
            expandedIndices.push(index)
          }
        })

        // Calculate width for each segment
        // Total gaps needed: (stackWindows.length - 1) gaps between windows
        const totalGaps = (stackWindows.length - 1) * inner
        const totalMinimizedWidth =
          minimizedStackCount * MINIMIZED_VERTICAL_WIDTH
        const expandedWidth =
          visibleStackCount > 0
            ? (stackAreaWidth - totalMinimizedWidth - totalGaps) /
              visibleStackCount
            : 0

        let _expandedIndex = 0
        const _currentY = startY + outer

        stackWindows.forEach((window, _index) => {
          if (window.isMinimized) {
            // Vertical bar for minimized window - in its position in the order
            positions.set(window.id, {
              x: currentX,
              y: startY + outer,
              width: MINIMIZED_VERTICAL_WIDTH,
              height: height - outer * 2,
              minimizeType: 'vertical',
            })
            currentX += MINIMIZED_VERTICAL_WIDTH + inner
          } else {
            // Expanded window takes calculated width (always use expandedWidth to account for minimized bars)
            positions.set(window.id, {
              x: currentX,
              y: startY + outer,
              width: expandedWidth,
              height: height - outer * 2,
            })
            currentX += expandedWidth + inner
            _expandedIndex++
          }
        })
      }
    }

    // Validate that all windows got positions assigned
    windows.forEach((window) => {
      const pos = positions.get(window.id)
      if (!pos) {
        console.error(
          `[TilingLayoutManager] Window ${window.id} did not get a position assigned!`,
          {
            isMinimized: window.isMinimized,
            totalWindows: windows.length,
            visibleCount: windows.filter((w) => !w.isMinimized).length,
          }
        )
      } else if (
        pos.width <= 0 ||
        pos.height <= 0 ||
        Number.isNaN(pos.x) ||
        Number.isNaN(pos.y)
      ) {
        console.error(
          `[TilingLayoutManager] Window ${window.id} has invalid bounds:`,
          pos
        )
      }
    })

    return positions
  }

  /**
   * Stacked layout with minimized windows - all windows stacked vertically
   */
  private stackedLayoutWithMinimized(
    windows: TiledWindow[],
    width: number,
    height: number,
    startY: number
  ): Map<number, WindowBounds> {
    const positions = new Map<number, WindowBounds>()
    const { inner, outer } = this.config.gaps
    const MINIMIZED_HORIZONTAL_HEIGHT = 40

    if (windows.length === 0) {
      return positions
    }

    // All windows in same column → collapse to horizontal bars
    const visibleWindows = windows.filter((w) => !w.isMinimized)
    const minimizedWindows = windows.filter((w) => w.isMinimized)

    const minimizedTotalHeight =
      minimizedWindows.length * (MINIMIZED_HORIZONTAL_HEIGHT + inner)
    const availableHeight =
      height - outer * 2 - minimizedTotalHeight - (windows.length - 1) * inner
    const visibleWindowHeight =
      visibleWindows.length > 0
        ? Math.floor(availableHeight / visibleWindows.length)
        : 0

    let currentY = startY + outer
    windows.forEach((window, index) => {
      if (window.isMinimized) {
        positions.set(window.id, {
          x: outer,
          y: currentY,
          width: width - outer * 2,
          height: MINIMIZED_HORIZONTAL_HEIGHT,
          minimizeType: 'horizontal',
        })
        currentY += MINIMIZED_HORIZONTAL_HEIGHT + inner
      } else {
        const isLast = index === windows.length - 1
        const thisHeight = isLast
          ? height - outer * 2 - (currentY - startY - outer)
          : visibleWindowHeight

        positions.set(window.id, {
          x: outer,
          y: currentY,
          width: width - outer * 2,
          height: thisHeight,
        })
        currentY += thisHeight + inner
      }
    })

    return positions
  }

  /**
   * Monocle layout - all windows fullscreen, only focused one visible
   */
  private monocleLayout(
    windows: TiledWindow[],
    width: number,
    height: number,
    startY: number
  ): Map<number, WindowBounds> {
    const positions = new Map<number, WindowBounds>()
    const { outer } = this.config.gaps

    // All windows get the same fullscreen bounds
    const bounds: WindowBounds = {
      x: outer,
      y: startY + outer,
      width: width - outer * 2,
      height: height - outer * 2,
    }

    windows.forEach((window) => {
      positions.set(window.id, bounds)
    })

    return positions
  }

  /**
   * Adjust master ratio (for resizing the master pane)
   */
  adjustMasterRatio(delta: number): void {
    this.config.masterRatio = Math.max(
      0.2,
      Math.min(0.8, this.config.masterRatio + delta)
    )
  }

  /**
   * Set layout mode
   */
  setLayoutMode(mode: LayoutMode): void {
    this.config.mode = mode
  }

  /**
   * Get current layout mode
   */
  getLayoutMode(): LayoutMode {
    return this.config.mode
  }

  /**
   * Set gap sizes
   */
  setGaps(inner?: number, outer?: number): void {
    if (inner !== undefined) this.config.gaps.inner = inner
    if (outer !== undefined) this.config.gaps.outer = outer
  }

  /**
   * Get current config
   */
  getConfig(): LayoutConfig {
    return { ...this.config }
  }

  /**
   * Set maximum window width constraint
   */
  setMaxWindowWidth(width?: number): void {
    this.config.maxWindowWidth = width
  }

  /**
   * Get maximum window width
   */
  getMaxWindowWidth(): number | undefined {
    return this.config.maxWindowWidth
  }
}
