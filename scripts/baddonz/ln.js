(function() {
    const style = document.createElement('style');
    style.textContent = `
    body.ln-active.ln-frame-loot-active .loot-wnd:has([data-item-type=t-leg]).border-window::before {
        border: none;
    }

    body.ln-active.ln-frame-loot-active .loot-wnd:has([data-item-type=t-leg]).border-window::after {
        top: -28px;
        left: -14px;
        width: calc(100% + 29px);
        height: calc(100% + 57px);
    }
    `;
    document.head.appendChild(style);
})();
