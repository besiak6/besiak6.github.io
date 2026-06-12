// ==UserScript==
// @name          Śmieciara baddonz
// @version       10.06.2026
// @description   Niszczenie przeterminowanych przedmiotów
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "TRASH";
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const ITEM_DESTROY_DELAY = 2000;

    let currentSettings = {
        enabled: true
    };

    let uiWindow = null;
    let pendingItems = [];
    let isDestroying = false;

    // ─── Settings ─────────────────────────────────────────────────────────────
    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const saved = window.BaddonzAPI.getAddonSettings(ADDON_ID);
        currentSettings = { ...currentSettings, ...saved };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, { ...currentSettings });
    }

    // ─── Item helpers ─────────────────────────────────────────────────────────
    function isExpired(item) {
        if (!item || item.loc !== 'g') return false;
        const stat = item.stat || item.stats || '';
        const match = stat.match(/expires=(\d+)/);
        if (match && match[1]) {
            return Date.now() > parseInt(match[1], 10) * 1000;
        }
        return false;
    }

    function getExpiredItems() {
        if (!window.Engine || !window.Engine.items) return [];
        return (window.Engine.items.fetchLocationItems('g') || []).filter(isExpired);
    }

    function destroyItem(itemId) {
        return new Promise(resolve => {
            window._g(`moveitem&st=-2&id=${itemId}`);
            setTimeout(resolve, ITEM_DESTROY_DELAY);
        });
    }

    // ─── UI ───────────────────────────────────────────────────────────────────
    function buildUI() {
        // Wstrzykujemy style dla okna Śmieciary
        if (!document.querySelector('.trash-wnd-styles')) {
            const style = document.createElement('style');
            style.className = 'trash-wnd-styles';
            style.textContent = `
                .baddonz-trash-wnd {
                    width: 280px;
                    min-width: 220px;
                }
                .baddonz-trash-wnd .baddonz-window-header .baddonz-window-controls.left {
                    visibility: hidden;
                    pointer-events: none;
                    width: 20px;
                }
                .trash-items-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    padding: 6px 4px 2px 4px;
                    min-height: 42px;
                    max-height: 160px;
                    overflow-y: auto;
                    justify-content: flex-start;
                    align-content: flex-start;
                }
                .trash-item-slot {
                    position: relative;
                    width: 36px;
                    height: 36px;
                    border: 1px solid #555;
                    background: rgba(0,0,0,0.4);
                    flex-shrink: 0;
                    cursor: default;
                }
                .trash-item-slot img.trash-item-gif {
                    width: 36px;
                    height: 36px;
                    display: block;
                    position: absolute;
                    top: 0; left: 0;
                    z-index: 1;
                }
                .trash-item-slot .trash-item-name-tooltip {
                    display: none;
                }
                .trash-footer {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    padding: 6px 4px 4px 4px;
                    border-top: 1px solid #333;
                    margin-top: 2px;
                }
                .trash-count-label {
                    font-size: 11px;
                    color: #aaa;
                    text-align: center;
                }
                .trash-destroy-btn {
                    width: 100%;
                    background: linear-gradient(180deg, #8b1a1a 0%, #5a0e0e 100%);
                    border: 1px solid #c0392b;
                    color: #fff;
                    font-size: 12px;
                    font-weight: bold;
                    padding: 5px 0;
                    cursor: pointer;
                    text-align: center;
                    letter-spacing: 0.5px;
                    transition: background 0.15s;
                }
                .trash-destroy-btn:hover {
                    background: linear-gradient(180deg, #a52020 0%, #6e1111 100%);
                }
                .trash-destroy-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `;
            document.head.appendChild(style);
        }

        const bodyHtml = `
            <div class="trash-items-grid" id="trash-items-grid"></div>
            <div class="trash-footer">
                <div class="trash-count-label" id="trash-count-label"></div>
                <button class="trash-destroy-btn" id="trash-destroy-btn">Zniszcz</button>
            </div>
        `;

        uiWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Śmieciara", bodyHtml, {
            customId: 'baddonz-trash-wnd',
            hasSettings: false,
            hasCollapse: false,
            hasClose: true
        });

        uiWindow.style.display = 'none';

        // Przycisk Zniszcz
        uiWindow.querySelector('#trash-destroy-btn').addEventListener('click', () => {
            if (isDestroying || pendingItems.length === 0) return;
            uiWindow.style.display = 'none';
            startDestroying([...pendingItems]);
        });

        // Przycisk zamknij
        uiWindow.querySelector('.baddonz-close-button').addEventListener('click', () => {
            uiWindow.style.display = 'none';
            pendingItems = [];
        });
    }

    function buildItemSlot(item) {
        const slot = document.createElement('div');
        slot.className = 'trash-item-slot';

        const iconSource = item.icon || `${item.id}.png`;
        const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');

        const img = document.createElement('img');
        img.className = 'trash-item-gif';
        img.src = MICC_BASE_URL + gifName;
        img.alt = item.name || '';

        // Podpinamy tip z nazwą jeśli jest dostępny
        slot.appendChild(img);

        if (item.$ && typeof $ === 'function' && typeof $.fn.tip === 'function') {
            const $cloned = item.$.clone();
            $cloned.css({ position: 'absolute', top: 0, left: 0, width: '36px', height: '36px', zIndex: 2 });
            $cloned.data('item', item);
            $cloned.find('canvas.icon, canvas.canvas-notice').remove();
            $(slot).append($cloned);
        } else if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            $(slot).tip(item.name || String(item.id));
        }

        return slot;
    }

    function showPopup(items) {
        if (!uiWindow) buildUI();
        if (!items || items.length === 0) return;

        pendingItems = items;

        const grid = uiWindow.querySelector('#trash-items-grid');
        const label = uiWindow.querySelector('#trash-count-label');
        const btn = uiWindow.querySelector('#trash-destroy-btn');

        grid.innerHTML = '';
        items.forEach(item => grid.appendChild(buildItemSlot(item)));

        label.textContent = `Znaleziono ${items.length} przeterminowanych przedmiotów`;
        btn.disabled = false;
        btn.textContent = 'Zniszcz';

        uiWindow.style.display = 'flex';

        // Wyśrodkowanie okna
        requestAnimationFrame(() => {
            const w = uiWindow.offsetWidth || 280;
            const h = uiWindow.offsetHeight || 200;
            uiWindow.style.left = `${Math.max(0, (window.innerWidth - w) / 2)}px`;
            uiWindow.style.top  = `${Math.max(0, (window.innerHeight - h) / 2)}px`;
        });
    }

    // ─── Destroy logic ────────────────────────────────────────────────────────
    async function startDestroying(items) {
        isDestroying = true;
        let destroyed = 0;
        for (const item of items) {
            await destroyItem(item.id);
            destroyed++;
        }
        if (window.message) {
            window.message(`Śmieciara: zniszczono ${destroyed} przeterminowanych przedmiotów.`);
        }
        pendingItems = [];
        isDestroying = false;
    }

    // ─── Scan ─────────────────────────────────────────────────────────────────
    function scan() {
        if (!currentSettings.enabled) return;
        const expired = getExpiredItems();
        if (expired.length > 0) {
            showPopup(expired);
        }
    }

    function hookAllInit() {
        if (!window.Engine) { setTimeout(hookAllInit, 500); return; }

        // Czekamy na Engine.allInit
        const origAllInit = window.Engine.allInit;
        if (typeof origAllInit === 'function') {
            window.Engine.allInit = function (...args) {
                const result = origAllInit.apply(this, args);
                setTimeout(scan, 1500);
                return result;
            };
        } else {
            // Fallback – obserwujemy przypisanie
            let hooked = false;
            Object.defineProperty(window.Engine, 'allInit', {
                configurable: true,
                get() { return this._allInit; },
                set(fn) {
                    this._allInit = function (...args) {
                        const result = fn.apply(this, args);
                        if (!hooked) { hooked = true; setTimeout(scan, 1500); }
                        return result;
                    };
                }
            });
        }
    }

    // ─── Init / Stop ──────────────────────────────────────────────────────────
    function addonInit() {
        loadSettings();
        if (!uiWindow) buildUI();
        hookAllInit();
    }

    function addonStop() {
        if (uiWindow) {
            uiWindow.style.display = 'none';
        }
        pendingItems = [];
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
        if (!isEnabled && uiWindow) {
            uiWindow.style.display = 'none';
            pendingItems = [];
        }
    }

    // ─── Register ─────────────────────────────────────────────────────────────
    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle });
    };
    checkApi();

})();
