// ChromaLens cross-browser picker — screenshot-based pixel sampling with magnifier.
// Used when window.EyeDropper is unavailable (Firefox, Safari).
import './picker-overlay.css';

declare global {
  interface Window {
    chromaLensPicking?: boolean;
  }
}

type PendingPick = {
  screenshot: string;
  dpr: number;
};

export default defineContentScript({
  registration: 'runtime',
  main() {
    // Prevent multiple injections
    if (window.chromaLensPicking) return;
    window.chromaLensPicking = true;

    void (async () => {
      const result = await browser.storage.local.get(['pendingPick']);
      const pending = result.pendingPick as PendingPick | undefined;
      if (!pending) {
        window.chromaLensPicking = false;
        return;
      }
      await browser.storage.local.remove('pendingPick');

      const { screenshot, dpr } = pending;

      // Load the captured viewport screenshot into a canvas (extension-owned data URL)
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          cleanup();
          return;
        }
        ctx.drawImage(img, 0, 0);

        // DOM: overlay, loupe (canvas), color chip, hint
        const overlay = document.createElement('div');
        overlay.id = 'chromalens-pick-overlay';

        const loupe = document.createElement('div');
        loupe.id = 'chromalens-pick-loupe';
        const loupeCanvas = document.createElement('canvas');
        loupeCanvas.width = 128;
        loupeCanvas.height = 128;
        const loupeCtx = loupeCanvas.getContext('2d');
        if (loupeCtx) {
          loupeCtx.imageSmoothingEnabled = false;
        }
        loupe.appendChild(loupeCanvas);

        const chip = document.createElement('div');
        chip.id = 'chromalens-pick-chip';
        chip.innerHTML =
          '<span id="chromalens-pick-swatch"></span>' +
          '<span id="chromalens-pick-hex">#000000</span>';

        const hint = document.createElement('div');
        hint.id = 'chromalens-pick-hint';
        hint.textContent = 'Click to pick • ESC to cancel';

        document.body.appendChild(overlay);
        document.body.appendChild(loupe);
        document.body.appendChild(chip);
        document.body.appendChild(hint);

        let currentHex = '#000000';

        // Sample the pixel under the cursor and paint the loupe
        const updatePick = (e: MouseEvent) => {
          const x = Math.floor(e.clientX * dpr);
          const y = Math.floor(e.clientY * dpr);
          if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;

          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const pr = pixel[0] ?? 0;
          const pg = pixel[1] ?? 0;
          const pb = pixel[2] ?? 0;
          currentHex =
            '#' +
            ((1 << 24) + (pr << 16) + (pg << 8) + pb)
              .toString(16)
              .slice(1)
              .toLowerCase();

          // Loupe: 8x zoom of the 16x16 region around the cursor (pixel-perfect)
          if (loupeCtx) {
            loupeCtx.clearRect(0, 0, 128, 128);
            loupeCtx.drawImage(
              canvas,
              x - 8,
              y - 8,
              16,
              16,
              0,
              0,
              128,
              128,
            );
            // Center pixel marker
            loupeCtx.strokeStyle = 'rgba(255,255,255,0.9)';
            loupeCtx.lineWidth = 1;
            loupeCtx.strokeRect(62.5, 62.5, 3, 3);
          }

          document.getElementById('chromalens-pick-swatch')!.style.backgroundColor = currentHex;
          document.getElementById('chromalens-pick-hex')!.textContent = currentHex;
        };

        const moveHandler = (e: MouseEvent) => {
          updatePick(e);
          // Follow the cursor with loupe + chip offset
          loupe.style.left = Math.min(e.clientX + 24, window.innerWidth - 150) + 'px';
          loupe.style.top = Math.max(e.clientY - 100, 12) + 'px';
          chip.style.left = Math.max(e.clientX - 60, 8) + 'px';
          chip.style.top = Math.max(e.clientY + 24, 12) + 'px';
        };

        const clickHandler = (e: MouseEvent) => {
          updatePick(e);
          cleanup();
          try {
            void browser.runtime.sendMessage({
              action: 'pick_selected',
              color: currentHex,
            });
          } catch {
            // Extension context invalidated
          }
        };

        const keyHandler = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            cleanup();
            try {
              void browser.runtime.sendMessage({ action: 'pick_cancelled' });
            } catch {
              // Ignore
            }
          }
        };

        overlay.addEventListener('mousemove', moveHandler);
        overlay.addEventListener('click', clickHandler);
        document.addEventListener('keydown', keyHandler);

        function cleanup() {
          window.chromaLensPicking = false;
          overlay.remove();
          loupe.remove();
          chip.remove();
          hint.remove();
          overlay.removeEventListener('mousemove', moveHandler);
          overlay.removeEventListener('click', clickHandler);
          document.removeEventListener('keydown', keyHandler);
        }

        // First paint
        const startEvent = new MouseEvent('mousemove', {
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2,
        });
        moveHandler(startEvent);
      };
      img.onerror = () => {
        window.chromaLensPicking = false;
        try {
          void browser.runtime.sendMessage({ action: 'pick_cancelled' });
        } catch {
          // Ignore
        }
      };
      img.src = screenshot;
    })();
  },
});
