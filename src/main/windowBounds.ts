export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

type DisplayEdge = 'top' | 'bottom' | 'left' | 'right';

function getRectCenter(rect: RectLike) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function clampWindowBounds(bounds: RectLike, workArea: RectLike): RectLike {
  return {
    x: clamp(bounds.x, workArea.x, workArea.x + workArea.width - bounds.width),
    y: clamp(bounds.y, workArea.y, workArea.y + workArea.height - bounds.height),
    width: bounds.width,
    height: bounds.height,
  };
}

export function getNearestDisplayEdge(rect: RectLike, displayBounds: RectLike): DisplayEdge {
  const center = getRectCenter(rect);
  const distances: Record<DisplayEdge, number> = {
    top: Math.abs(center.y - displayBounds.y),
    bottom: Math.abs(displayBounds.y + displayBounds.height - center.y),
    left: Math.abs(center.x - displayBounds.x),
    right: Math.abs(displayBounds.x + displayBounds.width - center.x),
  };

  return (Object.entries(distances).sort((left, right) => left[1] - right[1])[0]?.[0] ?? 'bottom') as DisplayEdge;
}

export function computeTopLeftWindowBounds(windowSize: WindowSize, workArea: RectLike, margin: number): RectLike {
  return clampWindowBounds(
    {
      x: workArea.x + margin,
      y: workArea.y + margin,
      width: windowSize.width,
      height: windowSize.height,
    },
    workArea,
  );
}

export function computeBottomRightWindowBounds(windowSize: WindowSize, workArea: RectLike, margin: number): RectLike {
  return clampWindowBounds(
    {
      x: workArea.x + workArea.width - windowSize.width - margin,
      y: workArea.y + workArea.height - windowSize.height - margin,
      width: windowSize.width,
      height: windowSize.height,
    },
    workArea,
  );
}

export function computeTrayAnchoredWindowBounds(
  windowSize: WindowSize,
  trayBounds: RectLike,
  displayBounds: RectLike,
  workArea: RectLike,
  margin: number,
): RectLike {
  const edge = getNearestDisplayEdge(trayBounds, displayBounds);
  const center = getRectCenter(trayBounds);

  switch (edge) {
    case 'top':
      return clampWindowBounds(
        {
          x: Math.round(center.x - windowSize.width / 2),
          y: workArea.y + margin,
          width: windowSize.width,
          height: windowSize.height,
        },
        workArea,
      );
    case 'left':
      return clampWindowBounds(
        {
          x: workArea.x + margin,
          y: Math.round(center.y - windowSize.height / 2),
          width: windowSize.width,
          height: windowSize.height,
        },
        workArea,
      );
    case 'right':
      return clampWindowBounds(
        {
          x: workArea.x + workArea.width - windowSize.width - margin,
          y: Math.round(center.y - windowSize.height / 2),
          width: windowSize.width,
          height: windowSize.height,
        },
        workArea,
      );
    case 'bottom':
    default:
      return clampWindowBounds(
        {
          x: Math.round(center.x - windowSize.width / 2),
          y: workArea.y + workArea.height - windowSize.height - margin,
          width: windowSize.width,
          height: windowSize.height,
        },
        workArea,
      );
  }
}
