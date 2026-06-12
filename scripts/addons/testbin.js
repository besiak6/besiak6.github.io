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
    const ITEM_DESTROY_DELAY = 2000;

    let currentSettings = {
        enabled: true,
        autoDestroy: false,
        windowOpacity: 2,
        settingsWindowVisible: false,
        windowSettingsOpacity: 2,
    };

    let uiPopupWindow = null;
    let uiSettingsWindow = null;
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

    // ─── Opacity helpers ──────────────────────────────────────────────────────
    function applyOpacityClass(wnd, opacity) {
        for (let i = 0; i < 5; i++) wnd.classList.remove(`opacity-${i}`);
        const baddonzData = JSON.parse(localStorage.getItem('BaddonzData') || '{}');
        const accId = window.BaddonzAPI?.accountId;
        const unified = baddonzData[accId]?.manager?.unifiedOpacityEnabled;
        if (unified) {
            const globalOp = baddonzData[accId]?.manager?.currentOpacity ?? 2;
            wnd.classList.add(`opacity-${globalOp}`);
        } else {
            wnd.classList.add(`opacity-${opacity}`);
        }
    }

    // ─── Build UI ─────────────────────────────────────────────────────────────
    function buildPopup() {
        if (uiPopupWindow) return;

        const bodyHtml = `
            <div id="trash-items-grid" style="
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding: 4px 2px;
                min-height: 42px;
                justify-content: center;
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

        uiPopupWindow.style.display = 'none';
        applyOpacityClass(uiPopupWindow, currentSettings.windowOpacity);

        // Opacity button – lewa strona
        const opacityBtn = uiPopupWindow.querySelector('.baddonz-opacity-button');
        if (opacityBtn) {
            opacityBtn.addEventListener('click', () => {
                const baddonzData = JSON.parse(localStorage.getItem('BaddonzData') || '{}');
                const accId = window.BaddonzAPI?.accountId;
                const unified = baddonzData[accId]?.manager?.unifiedOpacityEnabled;
                if (unified && window.setBaddonzGlobalOpacity) {
                    const cur = baddonzData[accId]?.manager?.currentOpacity ?? 2;
                    window.setBaddonzGlobalOpacity((cur + 1) % 5);
                } else {
                    currentSettings.windowOpacity = (currentSettings.windowOpacity + 1) % 5;
                    applyOpacityClass(uiPopupWindow, currentSettings.windowOpacity);
                    saveSettings();
                }
            });
        }

        // Zamknij
        const closeBtn = uiPopupWindow.querySelector('.baddonz-close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                uiPopupWindow.style.display = 'none';
            });
        }

        // Zniszcz
        const destroyBtn = uiPopupWindow.querySelector('.trash-destroy-btn');
        if (destroyBtn) {
            destroyBtn.addEventListener('click', () => {
                uiPopupWindow.style.display = 'none';
                startDestroying(pendingItems);
            });
        }
    }

    function buildSettingsWindow() {
        if (uiSettingsWindow) return;

        const bodyHtml = `
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox trash-auto-destroy ${currentSettings.autoDestroy ? 'active' : ''}"></div>
                <span class="baddonz-text">Automatyczne Niszczenie</span>
            </div>
        `;

        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(
            ADDON_ID,
            "Śmieciara - Ustawienia",
            bodyHtml,
            {
                width: '230px',
                customId: 'baddonz-trash-settings',
                hasSettings: false,
                hasCollapse: false,
                hasClose: true,
            }
        );

        uiSettingsWindow.classList.add('settings-window');
        uiSettingsWindow.removeAttribute('data-addon-id');
        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';
        applyOpacityClass(uiSettingsWindow, currentSettings.windowSettingsOpacity);

        // Opacity button
        const opacityBtn = uiSettingsWindow.querySelector('.baddonz-opacity-button');
        if (opacityBtn) {
            opacityBtn.addEventListener('click', () => {
                const baddonzData = JSON.parse(localStorage.getItem('BaddonzData') || '{}');
                const accId = window.BaddonzAPI?.accountId;
                const unified = baddonzData[accId]?.manager?.unifiedOpacityEnabled;
                if (unified && window.setBaddonzGlobalOpacity) {
                    const cur = baddonzData[accId]?.manager?.currentOpacity ?? 2;
                    window.setBaddonzGlobalOpacity((cur + 1) % 5);
                } else {
                    currentSettings.windowSettingsOpacity = (currentSettings.windowSettingsOpacity + 1) % 5;
                    applyOpacityClass(uiSettingsWindow, currentSettings.windowSettingsOpacity);
                    saveSettings();
                }
            });
        }

        // Zamknij
        const closeBtn = uiSettingsWindow.querySelector('.baddonz-close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                uiSettingsWindow.style.display = 'none';
                currentSettings.settingsWindowVisible = false;
                saveSettings();
            });
        }

        // Checkbox auto-destroy
        const autoDestroyCb = uiSettingsWindow.querySelector('.trash-auto-destroy');
        if (autoDestroyCb) {
            autoDestroyCb.addEventListener('click', () => {
                currentSettings.autoDestroy = autoDestroyCb.classList.toggle('active');
                saveSettings();
            });
        }

        // Tooltip
        if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
            const opBtn = uiSettingsWindow.querySelector('.baddonz-opacity-button');
            const clBtn = uiSettingsWindow.querySelector('.baddonz-close-button');
            if (opBtn) $(opBtn).tip('Zmień przezroczystość');
            if (clBtn) $(clBtn).tip('Zamknij');
            if (autoDestroyCb) $(autoDestroyCb).tip('Gdy włączone – itemy są niszczone automatycznie bez okna potwierdzenia');
        }

        // Obserwator widoczności
        const obs = new MutationObserver(() => {
            const isVisible = uiSettingsWindow.style.display !== 'none';
            if (currentSettings.settingsWindowVisible !== isVisible) {
                currentSettings.settingsWindowVisible = isVisible;
                saveSettings();
            }
        });
        obs.observe(uiSettingsWindow, { attributes: true, attributeFilter: ['style'] });
    }

    // ─── Center popup ─────────────────────────────────────────────────────────
    function centerWindow(wnd) {
        const w = wnd.offsetWidth || 220;
        const h = wnd.offsetHeight || 160;
        wnd.style.left = `${Math.max(0, (window.innerWidth - w) / 2)}px`;
        wnd.style.top  = `${Math.max(0, (window.innerHeight - h) / 2)}px`;
    }

    // ─── Render items in popup ────────────────────────────────────────────────
    function renderItemsInPopup(items) {
        const grid = uiPopupWindow.querySelector('#trash-items-grid');
        if (!grid) return;
        grid.innerHTML = '';

        items.forEach(item => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
                position: relative;
                width: 32px;
                height: 32px;
                flex-shrink: 0;
            `;

            // Budujemy GIF z MICC – to jest właściwy sposób pokazania itemu
            const iconSource = item.icon || `${item.id}.png`;
            const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');

            const img = document.createElement('img');
            img.src = MICC_BASE_URL + gifName;
            img.style.cssText = 'width:32px; height:32px; display:block; position:absolute; top:0; left:0; z-index:1;';
            img.title = item.name || '';
            wrapper.appendChild(img);

            // Jeśli istnieje klon DOM itemu to go nakładamy (daje efekty jakości itp.)
            if (item.$ && item.$.length) {
                const $clone = item.$.clone();
                $clone.find('canvas.icon, canvas.canvas-notice').remove();
                $clone.css({
                    position: 'absolute',
                    width: '32px',
                    height: '32px',
                    top: '0',
                    left: '0',
                    zIndex: '2',
                });
                $clone.data('item', item);
                wrapper.appendChild($clone[0]);
            }

            // Tooltip z nazwą
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(wrapper).tip(item.name || '');
            } else {
                wrapper.title = item.name || '';
            }

            grid.appendChild(wrapper);
        });
    }

    function showPopup(items) {
        if (!uiPopupWindow) buildPopup();
        pendingItems = items;
        renderItemsInPopup(items);
        uiPopupWindow.style.display = 'flex';
        requestAnimationFrame(() => {
            centerWindow(uiPopupWindow);
            uiPopupWindow.dispatchEvent(new Event('mousedown'));
        });
    }

    // ─── Destroy logic ────────────────────────────────────────────────────────
    function startDestroying(items) {
        if (!items || items.length === 0) return;
        let index = 0;
        const count = items.length;

        function next() {
            if (index >= count) {
                if (typeof window.message === 'function') {
                    window.message(`Zniszczono ${count} przeterminowanych itemów.`);
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
        if (expired.length === 0) return;

        if (currentSettings.autoDestroy) {
            startDestroying(expired);
        } else {
            showPopup(expired);
        }
    }

    // ─── Init / Stop ──────────────────────────────────────────────────────────
    function addonInit() {
        loadSettings();
        if (!uiPopupWindow) buildPopup();
        if (!uiSettingsWindow) buildSettingsWindow();

        // Scan od razu – bez delay
        scan();
    }

    function addonStop() {
        if (uiPopupWindow) uiPopupWindow.style.display = 'none';
        if (uiSettingsWindow) uiSettingsWindow.style.display = 'none';
        pendingItems = [];
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
        if (!isEnabled) {
            if (uiPopupWindow) uiPopupWindow.style.display = 'none';
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
