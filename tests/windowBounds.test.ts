import { describe, expect, it } from 'vitest';
import {
  clampWindowBounds,
  computeBottomRightWindowBounds,
  computeTopLeftWindowBounds,
  computeTrayAnchoredWindowBounds,
  getNearestDisplayEdge,
} from '../src/main/windowBounds';

describe('getNearestDisplayEdge', () => {
  const displayBounds = { x: 0, y: 0, width: 1920, height: 1080 };

  it('detects bottom taskbar placement', () => {
    expect(getNearestDisplayEdge({ x: 1750, y: 1040, width: 40, height: 40 }, displayBounds)).toBe('bottom');
  });

  it('detects right taskbar placement', () => {
    expect(getNearestDisplayEdge({ x: 1880, y: 820, width: 40, height: 40 }, displayBounds)).toBe('right');
  });
});

describe('computeTrayAnchoredWindowBounds', () => {
  const windowSize = { width: 380, height: 220 };

  it('anchors above a bottom taskbar and clamps inside work area', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
    const bounds = computeTrayAnchoredWindowBounds(
      windowSize,
      { x: 1840, y: 1040, width: 40, height: 40 },
      { x: 0, y: 0, width: 1920, height: 1080 },
      workArea,
      16,
    );

    expect(bounds.y).toBe(804);
    expect(bounds.x).toBe(1540);
  });

  it('anchors inside the work area for a left taskbar', () => {
    const workArea = { x: 56, y: 0, width: 1864, height: 1080 };
    const bounds = computeTrayAnchoredWindowBounds(
      windowSize,
      { x: 0, y: 960, width: 56, height: 56 },
      { x: 0, y: 0, width: 1920, height: 1080 },
      workArea,
      16,
    );

    expect(bounds.x).toBe(72);
    expect(bounds.y).toBe(860);
  });
});

describe('window fallback bounds', () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1080 };

  it('places the macOS window in the top-left corner', () => {
    expect(computeTopLeftWindowBounds({ width: 380, height: 220 }, workArea, 16)).toEqual({
      x: 16,
      y: 16,
      width: 380,
      height: 220,
    });
  });

  it('places the Windows fallback window in the bottom-right corner', () => {
    expect(computeBottomRightWindowBounds({ width: 380, height: 220 }, workArea, 16)).toEqual({
      x: 1524,
      y: 844,
      width: 380,
      height: 220,
    });
  });

  it('clamps oversized bounds into the work area', () => {
    expect(
      clampWindowBounds(
        { x: 1800, y: 1000, width: 300, height: 200 },
        { x: 0, y: 0, width: 1920, height: 1080 },
      ),
    ).toEqual({
      x: 1620,
      y: 880,
      width: 300,
      height: 200,
    });
  });
});
