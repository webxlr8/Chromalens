// ChromaLens Area Selection Content Script (injected on demand)
// Ported from content/select-area.js
import './area-select.css';

declare global {
  interface Window {
    chromaLensSelecting?: boolean;
  }
}

export default defineContentScript({
  registration: 'runtime',
  main() {
    // Prevent multiple injections
    if (window.chromaLensSelecting) return;
    window.chromaLensSelecting = true;

    // Create DOM elements
    const overlay = document.createElement('div');
    overlay.id = 'chromalens-overlay';

    const selection = document.createElement('div');
    selection.id = 'chromalens-selection';

    const instruction = document.createElement('div');
    instruction.id = 'chromalens-instruction';
    instruction.textContent =
      'Selection Mode • Click and drag to select an area • Press ESC to cancel';

    document.body.appendChild(overlay);
    document.body.appendChild(selection);
    document.body.appendChild(instruction);

    // State
    let startX = 0;
    let startY = 0;
    let isSelecting = false;

    // Cleanup function
    function cleanup() {
      window.chromaLensSelecting = false;
      overlay.remove();
      selection.remove();
      instruction.remove();
      document.removeEventListener('keydown', handleKeydown);
    }

    // Key handler
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        cleanup();
        // Send cancellation message
        try {
          void browser.runtime.sendMessage({ action: 'selection_cancelled' });
        } catch {
          // Ignore context invalidated error
        }
      }
    }

    document.addEventListener('keydown', handleKeydown);

    // Mouse events
    overlay.addEventListener('mousedown', (e) => {
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;

      selection.style.left = startX + 'px';
      selection.style.top = startY + 'px';
      selection.style.width = '0';
      selection.style.height = '0';
      selection.style.display = 'block';

      // Remove overlay background to create spotlight effect via selection box shadow
      overlay.style.background = 'transparent';
    });

    overlay.addEventListener('mousemove', (e) => {
      if (!isSelecting) return;

      const currentX = e.clientX;
      const currentY = e.clientY;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      selection.style.left = left + 'px';
      selection.style.top = top + 'px';
      selection.style.width = width + 'px';
      selection.style.height = height + 'px';
    });

    overlay.addEventListener('mouseup', (e) => {
      if (!isSelecting) return;
      isSelecting = false;

      const currentX = e.clientX;
      const currentY = e.clientY;

      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);

      // Minimum selection size check
      if (width < 5 || height < 5) {
        cleanup();
        try {
          void browser.runtime.sendMessage({ action: 'selection_cancelled' });
        } catch {
          // Ignore context invalidated error
        }
        return;
      }

      // Capture bounds
      const bounds = {
        x: left * window.devicePixelRatio,
        y: top * window.devicePixelRatio,
        width: width * window.devicePixelRatio,
        height: height * window.devicePixelRatio,
        devicePixelRatio: window.devicePixelRatio,
      };

      cleanup();

      // Send bounds to background logic
      try {
        void browser.runtime.sendMessage({
          action: 'area_selected',
          bounds,
        });
      } catch {
        // Failed to send, extension context may be invalidated
      }
    });
  },
});
