// reveal.js plugin: lets the deck's keys step pyxcd animations embedded in
// iframes (saved with board.save(..., chrome="embed")).
//
// On a slide with a pyxcd animation, next/prev keys go to the animation first;
// when it replies that it is already at its last (or first) step, the deck moves
// on. Every other slide, and every other key, is left to reveal.js. Animations
// announce themselves with {pyxcd: 'hello'}, so no markup is needed on the iframe.
window.PyxcdBridge = function () {
  const NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ']);
  const PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp']);
  const players = new Set();   // contentWindows of iframes that said hello
  const waiting = new Map();   // message id -> { timer, deckAction }
  let lastId = 0;

  return {
    id: 'pyxcd-bridge',
    init(deck) {
      const frameOnSlide = () => {
        const slide = deck.getCurrentSlide();
        if (!slide) return null;
        return [...slide.querySelectorAll('iframe')]
          .find(f => f.contentWindow && players.has(f.contentWindow)) || null;
      };

      const send = (frame, dir, deckAction) => {
        const id = ++lastId;
        // No answer (e.g. the animation is reloading)? Move the deck instead.
        const timer = setTimeout(() => { waiting.delete(id); deckAction(); }, 400);
        waiting.set(id, { timer, deckAction });
        frame.contentWindow.postMessage({ pyxcd: dir, id }, '*');
      };

      window.addEventListener('message', e => {
        const msg = e.data;
        if (!msg || typeof msg.pyxcd !== 'string') return;
        if (msg.pyxcd === 'hello') { if (e.source) players.add(e.source); return; }
        if (msg.pyxcd !== 'reply' || !waiting.has(msg.id)) return;
        const { timer, deckAction } = waiting.get(msg.id);
        clearTimeout(timer);
        waiting.delete(msg.id);
        if (!msg.moved) deckAction();
      });

      // Animations that loaded before this plugin started: ask them to say hello.
      document.querySelectorAll('.reveal iframe').forEach(f => {
        if (f.contentWindow) f.contentWindow.postMessage({ pyxcd: 'ping' }, '*');
      });

      // Capture phase, so this runs before reveal.js's own key handler.
      document.addEventListener('keydown', e => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (deck.isOverview && deck.isOverview()) return;
        // R toggles scroll view, which moves every slide in the DOM; that reloads
        // the iframes and restarts every animation. Off in decks that have any.
        if ((e.key === 'r' || e.key === 'R') && players.size) {
          e.preventDefault(); e.stopImmediatePropagation();
          return;
        }
        const dir = NEXT.has(e.key) ? 'next' : PREV.has(e.key) ? 'prev' : null;
        if (!dir) return;
        const frame = frameOnSlide();
        if (!frame) return;
        e.preventDefault(); e.stopImmediatePropagation();
        send(frame, dir, dir === 'next' ? () => deck.next() : () => deck.prev());
      }, true);

      // Clicking an animation advances it, but must not leave focus inside it.
      window.addEventListener('blur', () => setTimeout(() => {
        const el = document.activeElement;
        if (el && el.tagName === 'IFRAME' && players.has(el.contentWindow)) {
          el.blur();
          window.focus();
        }
      }, 0));
    },
  };
};
