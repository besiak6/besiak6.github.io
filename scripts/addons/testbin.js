// ==UserScript==
// @name          Śmieciara baddonz
// @version       10.06.2026
// @description   Niszczy przeterminowane przedmioty w plecaku
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
        settingsWindowOpacity: 2,
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

    // ─── Opacity helpers ──────────────────────────────────────────────────────
    function applyOpacity(wnd, value) {
        for (let i = 0; i < 5; i++) wnd.classList.remove(`opacity-${i}`);
        const baddonzData = JSON.parse(localStorage.getItem('BaddonzData') || '{}');
        const accId = window.BaddonzAPI?.accountId;
        const unified = baddonzData[accId]?.manager?.unifiedOpacityEnabled;
        if (unified) {
            const globalOp = baddonzData[accId]?.manager?.currentOpacity ?? 2;
            wnd.classList.add(`opacity-${globalOp}`);
        } else {
            wnd.classList.add(`opacity-${value}`);
        }
    }

    function cycleOpacity(wnd, settingKey) {
        const baddonzData = JSON.parse(localStorage.getItem('BaddonzData') || '{}');
        const accId = window.BaddonzAPI?.accountId;
        const unified = baddonzData[accId]?.manager?.unifiedOpacityEnabled;
        if (unified && window.setBaddonzGlobalOpacity) {
            const cur = baddonzData[accId]?.manager?.currentOpacity ?? 2;
            window.setBaddonzGlobalOpacity((cur + 1) % 5);
        } else {
            currentSettings[settingKey] = (currentSettings[settingKey] + 1) % 5;
            applyOpacity(wnd, currentSettings[settingKey]);
            saveSettings();
        }
    }

    function centerWindow(wnd) {
        requestAnimationFrame(() => {
            const w = wnd.offsetWidth || 220;
            const h = wnd.offsetHeight || 160;
            wnd.style.left = `${Math.max(0, (window.innerWidth - w) / 2)}px`;
            wnd.style.top  = `${Math.max(0, (window.innerHeight - h) / 2)}px`;
        });
    }

    // ─── Popup okno ───────────────────────────────────────────────────────────
    function buildPopup() {
        if (uiPopupWindow) return;

        const bodyHtml = `
            <div id="trash-items-grid" style="
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding: 2px;
                min-height: 42px;
                justify-content: center;
                align-items: flex-start;
            "></div>
            <div style="display: flex; justify-content: center; margin-top: 6px;">
                <button class="baddonz-button trash-destroy-btn" style="width: 100%; padding: 4px 0;">Zniszcz</button>
            </div>
        `;

        uiPopupWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Śmieciara", bodyHtml, {
            width: '220px',
            customId: 'baddonz-trash-popup',
            hasSettings: false,
            hasCollapse: false,
            hasClose: true,
        });

        uiPopupWindow.style.display = 'none';
        applyOpacity(uiPopupWindow, currentSettings.windowOpacity);

        // Przycisk przezroczystości
        const opacityBtn = uiPopupWindow.querySelector('.baddonz-opacity-button');
        if (opacityBtn) {
            opacityBtn.addEventListener('click', () => cycleOpacity(uiPopupWindow, 'windowOpacity'));
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(opacityBtn).tip('Zmień przezroczystość');
            }
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
                display: inline-block;
            `;

            // Nazwa pliku GIF z MICC
            const iconSource = item.icon || `${item.id}.png`;
            const gifName = iconSource.replace(/\.[^/.]+$/, '.gif');

            // Klonujemy element DOM itemu
            if (item.$ && item.$.length) {
                const $clone = item.$.clone();
                $clone.find('canvas').remove();
                $clone.removeAttr('style');
                $clone.css({
                    position: 'absolute',
                    width: '32px',
                    height: '32px',
                    top: '0',
                    left: '0',
                });
                $clone.data('item', item);
                wrapper.appendChild($clone[0]);
            }

            // GIF na wierzch – zastępuje statyczną grafikę kanonicznym gifem
            const gif = document.createElement('img');
            gif.src = MICC_BASE_URL + gifName;
            gif.style.cssText = `
                position: absolute;
                width: 32px;
                height: 32px;
                top: 0;
                left: 0;
                z-index: 2;
                pointer-events: none;
            `;
            wrapper.appendChild(gif);

            // Tooltip
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
        centerWindow(uiPopupWindow);
        uiPopupWindow.dispatchEvent(new Event('mousedown'));
    }

    // ─── Okno ustawień ────────────────────────────────────────────────────────
    function buildSettingsWindow() {
        if (uiSettingsWindow) return;

        const bodyHtml = `
            <div class="baddonz-setting-row">
                <div class="baddonz-checkbox trash-auto-destroy ${currentSettings.autoDestroy ? 'active' : ''}"></div>
                <span class="baddonz-text">Automatyczne Niszczenie</span>
            </div>
        `;

        uiSettingsWindow = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Śmieciara - Ustawienia", bodyHtml, {
            width: '230px',
            customId: 'baddonz-trash-settings',
            hasSettings: false,
            hasCollapse: false,
            hasClose: true,
        });

        uiSettingsWindow.style.display = currentSettings.settingsWindowVisible ? 'flex' : 'none';
        applyOpacity(uiSettingsWindow, currentSettings.settingsWindowOpacity);

        // Przycisk przezroczystości
        const opacityBtn = uiSettingsWindow.querySelector('.baddonz-opacity-button');
        if (opacityBtn) {
            opacityBtn.addEventListener('click', () => cycleOpacity(uiSettingsWindow, 'settingsWindowOpacity'));
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(opacityBtn).tip('Zmień przezroczystość');
            }
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

        // Checkbox auto-niszczenia
        const autoCb = uiSettingsWindow.querySelector('.trash-auto-destroy');
        if (autoCb) {
            autoCb.addEventListener('click', () => {
                currentSettings.autoDestroy = autoCb.classList.toggle('active');
                saveSettings();
            });
            if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                $(autoCb).tip('Niszczy itemy automatycznie bez pytania');
            }
        }
    }

    function updateSettingsUI() {
        if (!uiSettingsWindow) return;
        const autoCb = uiSettingsWindow.querySelector('.trash-auto-destroy');
        if (autoCb) autoCb.classList.toggle('active', currentSettings.autoDestroy);
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
        if (!uiSettingsWindow) buildSettingsWindow();
        if (!uiPopupWindow) buildPopup();

        // Obserwujemy widoczność okna ustawień żeby zapisywać stan
        if (uiSettingsWindow) {
            const obs = new MutationObserver(() => {
                const isVisible = uiSettingsWindow.style.display !== 'none';
                if (currentSettings.settingsWindowVisible !== isVisible) {
                    currentSettings.settingsWindowVisible = isVisible;
                    saveSettings();
                }
            });
            obs.observe(uiSettingsWindow, { attributes: true, attributeFilter: ['style'] });
        }

        updateSettingsUI();
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
