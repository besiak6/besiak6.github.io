// ==UserScript==
// @name          Śmieciara baddonz
// @version       10.06.2026
// @description   Automatycznie niszczy przeterminowane przedmioty w plecaku
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    const ADDON_ID = "TRASH";
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';
    const SCAN_DELAY = 5000;
    const ITEM_DESTROY_DELAY = 2000;

    let currentSettings = {
        enabled: true,
    };

    let uiPopupWindow = null;
    let pendingItems = [];

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
        window._g(`moveitem&st=-2&id=${itemId}`);
    }

    // ─── UI ───────────────────────────────────────────────────────────────────
    function buildPopup() {
        if (uiPopupWindow) return;

        const bodyHtml = `
            <div id="trash-items-grid" style="
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding: 4px;
                min-height: 42px;
                justify-content: flex-start;
                align-items: flex-start;
            "></div>
            <div style="display: flex; justify-content: center; margin-top: 6px;">
                <button class="baddonz-button trash-destroy-btn" style="width: 100%; padding: 4px 0;">Zniszcz</button>
            </div>
        `;

        uiPopupWindow = window.BaddonzAPI.createAddonWindow(
            ADDON_ID,
            "Śmieciara",
            bodyHtml,
            {
                width: '220px',
                customId: 'baddonz-trash-popup',
                hasSettings: false,
                hasCollapse: false,
                hasClose: true,
            }
        );

        // Usuwamy przycisk zmiany przezroczystości – nie potrzebny w tym oknie
        const opacityBtn = uiPopupWindow.querySelector('.baddonz-opacity-button');
        if (opacityBtn) opacityBtn.remove();

        uiPopupWindow.style.display = 'none';

        // Przycisk zamknij
        const closeBtn = uiPopupWindow.querySelector('.baddonz-close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                uiPopupWindow.style.display = 'none';
            });
        }

        // Przycisk Zniszcz
        const destroyBtn = uiPopupWindow.querySelector('.trash-destroy-btn');
        if (destroyBtn) {
            destroyBtn.addEventListener('click', () => {
                uiPopupWindow.style.display = 'none';
                startDestroying(pendingItems);
            });
        }
    }

    function centerWindow(wnd) {
        const w = wnd.offsetWidth || 220;
        const h = wnd.offsetHeight || 160;
        wnd.style.left = `${Math.max(0, (window.innerWidth - w) / 2)}px`;
        wnd.style.top  = `${Math.max(0, (window.innerHeight - h) / 2)}px`;
    }

    function renderItemsInPopup(items) {
        const grid = uiPopupWindow.querySelector('#trash-items-grid');
        if (!grid) return;
        grid.innerHTML = '';

        items.forEach(item => {
            // Wrapper – taki sam rozmiar jak slot itemu w grze
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
                position: relative;
                width: 32px;
                height: 32px;
                flex-shrink: 0;
            `;

            // Klonujemy element DOM itemu jeśli istnieje
            if (item.$ && item.$.length) {
                const $clone = item.$.clone();
                $clone.find('canvas.icon, canvas.canvas-notice').remove();
                $clone.css({ position: 'relative', width: '32px', height: '32px', top: '0', left: '0' });
                $clone.data('item', item);

                // Nakładamy GIF z MICC (tak jak w Ulepszarze)
                const iconSource = item.icon || `${item.id}.png`;
                const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
                const $img = $('<img>')
                    .attr('src', MICC_BASE_URL + gifName)
                    .css({ width: '32px', height: '32px', position: 'absolute', top: '0', left: '0', zIndex: '0' });
                $clone.append($img);

                wrapper.appendChild($clone[0]);
            } else {
                // Fallback: sam obrazek z MICC
                const iconSource = item.icon || `${item.id}.png`;
                const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');
                const img = document.createElement('img');
                img.src = MICC_BASE_URL + gifName;
                img.style.cssText = 'width:32px; height:32px; display:block;';
                img.title = item.name || '';
                wrapper.appendChild(img);
            }

            // Tooltip z nazwą itemu jeśli jQuery tip dostępny
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(wrapper).tip(item.name || '');
            }

            grid.appendChild(wrapper);
        });
    }

    function showPopup(items) {
        if (!uiPopupWindow) buildPopup();
        pendingItems = items;
        renderItemsInPopup(items);
        uiPopupWindow.style.display = 'flex';

        // Centrujemy po wyrenderowaniu
        requestAnimationFrame(() => centerWindow(uiPopupWindow));

        // Wynosimy na wierzch
        uiPopupWindow.dispatchEvent(new Event('mousedown'));
    }

    // ─── Destroy logic ────────────────────────────────────────────────────────
    function startDestroying(items) {
        if (!items || items.length === 0) return;
        let index = 0;

        function next() {
            if (index >= items.length) {
                if (typeof window.message === 'function') {
                    window.message(`Zniszczono ${items.length} przeterminowanych itemów.`);
                }
                return;
            }
            destroyItem(items[index].id);
            index++;
            setTimeout(next, ITEM_DESTROY_DELAY);
        }

        next();
    }

    // ─── Scan ─────────────────────────────────────────────────────────────────
    function scan() {
        if (!currentSettings.enabled) return;
        const expired = getExpiredItems();
        if (expired.length > 0) {
            showPopup(expired);
        }
    }

    // ─── Init / Stop ──────────────────────────────────────────────────────────
    function addonInit() {
        loadSettings();
        if (!uiPopupWindow) buildPopup();
        setTimeout(scan, SCAN_DELAY);
    }

    function addonStop() {
        if (uiPopupWindow) {
            uiPopupWindow.style.display = 'none';
        }
        pendingItems = [];
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
        if (!isEnabled && uiPopupWindow) {
            uiPopupWindow.style.display = 'none';
        }
    }

    // ─── API check ────────────────────────────────────────────────────────────
    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500);
            return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, {
            init: addonInit,
            stop: addonStop,
            onStateToggle: onStateToggle,
        });
    };

    checkApi();

})();
