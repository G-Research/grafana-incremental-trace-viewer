import React from 'react';
import { Icon } from '@grafana/ui';

interface SpanOverlayDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  panelWidth: number;
}

/**
 * Easily tunable drawer width constraints
 * Limits are set in both absolute and relative terms
 * The default width is 50% of panel width, but no more than 378px
 * The maximum width is 75% of panel width, but no more than 920px
 * The minimum width is set to 220px
 * The maximum percentage is set to 75%
 */
const DRAWER_MIN_WIDTH_PX = 220; // minimum comfortable width
const DRAWER_MAX_WIDTH_PX = 920; // maximum absolute width
const DRAWER_MAX_PERCENT = 75; // maximum as percentage of panel width
const DRAWER_DEFAULT_PERCENT = 50; // default as percentage of panel width
const DRAWER_DEFAULT_PX = 378; // default maximum absolute width

export const SpanOverlayDrawer: React.FC<SpanOverlayDrawerProps> = ({
  isOpen,
  onClose,
  children,
  title = 'Span Details',
  panelWidth,
}) => {
  // Default width: up to 50% of panel width, but no more than 378px
  const defaultWidthPx = Math.min(panelWidth * (DRAWER_DEFAULT_PERCENT / 100), DRAWER_DEFAULT_PX);
  const [widthPercent, setWidthPercent] = React.useState<number>((defaultWidthPx / panelWidth) * 100);
  const isResizingRef = React.useRef<boolean>(false);
  const drawerRef = React.useRef<HTMLDivElement | null>(null);

  const onMouseDownResize = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isResizingRef.current = true;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    const controller = new AbortController();
    // Resize by dragging the left edge of the drawer
    window.addEventListener(
      'mousemove',
      (e: MouseEvent) => {
        if (!isResizingRef.current) {
          return;
        }
        const drawer = drawerRef.current;
        const container = drawer?.parentElement as HTMLElement | null; // absolute container from TraceDetail
        if (!container) {
          return;
        }
        const bounds = container.getBoundingClientRect();
        // Desired width is distance from mouse to the right edge of the container
        const widthPx = Math.max(0, bounds.right - e.clientX);
        const minPx = DRAWER_MIN_WIDTH_PX; // minimum comfortable width
        const maxPx = Math.min(bounds.width * (DRAWER_MAX_PERCENT / 100), DRAWER_MAX_WIDTH_PX);
        const clamped = Math.min(Math.max(widthPx, minPx), maxPx);
        const percent = (clamped / bounds.width) * 100;
        setWidthPercent(percent);
      },
      { signal: controller.signal }
    );
    window.addEventListener(
      'mouseup',
      () => {
        if (isResizingRef.current) {
          isResizingRef.current = false;
        }
      },
      { signal: controller.signal }
    );
    return () => controller.abort();
  }, [isOpen]);

  const drawerWidth = `${(widthPercent / 100) * panelWidth}px`;

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black opacity-20 z-[998]" onClick={onClose} />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="absolute top-0 right-0 h-full bg-gray-800 border-l border-gray-700 shadow-lg overflow-hidden z-[1000]"
        style={{
          width: drawerWidth,
          transform: 'translateX(0)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {/* Resize handle on the left edge */}
        <div
          onMouseDown={onMouseDownResize}
          title="Drag to resize"
          className="absolute top-0 left-0 h-full w-[6px] cursor-col-resize hover:bg-gray-600/50 active:bg-gray-500/60 z-[1001]"
        >
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-[2px] pointer-events-none">
            <span className="block w-1 h-1 rounded-full bg-gray-400"></span>
            <span className="block w-1 h-1 rounded-full bg-gray-400"></span>
            <span className="block w-1 h-1 rounded-full bg-gray-400"></span>
          </div>
        </div>
        {/* Header */}
        <div className="absolute top-0 right-0">
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            aria-label="Close drawer"
          >
            <Icon name="times" className="text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto pl-2 pr-1 py-1">{children}</div>
      </div>
    </>
  );
};
