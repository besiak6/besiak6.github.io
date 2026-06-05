// ==UserScript==
// @name          Baddonz
// @version       2.0.6
// @description   Menadżer dodatków
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// @icon          https://i.imgur.com/OAtRFEw.png
// ==/UserScript==

(function() {
    'use strict';

    const CSS_URL = "https://besiak6.github.io/styles/beta.css";
    const STORAGE_KEY = 'BaddonzData';

    const TOOLTIP_TEXTS = {
        opacityButton: "Zmień przezroczystość okienka",
        collapseButtonCollapsed: "Rozwiń",
        collapseButtonExpanded: "Zwiń",
        closeButton: "Zamknij",
        toggleManagerHotkey: "Kliknij, aby ustawić nowy skrót",
        blurBackground: "Rozmazuje tło wszystkich okienek",
        unifiedOpacity: "Ustawia jednakową przezroczystość dla wszystkich okien",
        addonSettingsWindow: "Ustawienia",
        addonWindow: "Otwórz okno dodatku",
        resetPositions: "Resetuje pozycje wszystkich okienek",
        resetHotkey: "Kliknij, aby ustawić nowy skrót",
        hotkeyResetTip: "x2 PPM Reset Skrótu",
        dock: "Włącz/Wyłącz wysuwany dock na dodatki",
        search: "Wyszukaj dodatek",
    };
    const ADDONS = {
        UPG: {
            name: "Ulepszara",
            desc: "Automatyczne ulepszanie wybranego itemu wraz z konfiguracją",
            url: "https://besiak6.github.io/scripts/addons/testupg.js",
            icon: "fa-arrow-trend-up",
            wnd: true,
            settings: true,
            windowId: "wnd-ulepszara",
            settingswnd: "wnd-ulepszara-settings"
        },
        ZT: {
            name: "Znacznik Teleportów",
            desc: "Podpisuje teleporty, możliwość edytowania podpisów i dodawania nowych",
            url: "https://besiak6.github.io/scripts/addons/testzt.js",
            icon: "fa-diamond-turn-right",
        },
        RG: {name: "Rozwiazywanie Grupy", desc: "Rozwiazywanie grupy z konfiguracja", url: "https://besiak6.github.io/scripts/addons/testrg.js", wnd: true, windowId: "rg-wnd"},
        II: { name: "TEST", desc: "ITEM", url: "https://besiak6.github.io/scripts/addons/testii.js", icon: "fa-trash-can" },
        FG: { name: "Free Gift", desc: "Automatyczne odbieranie kalendarza", url: "https://besiak6.github.io/scripts/addons/testgift.js", icon: "fa-gift" },
        ZW: { name: "Zasięg Walki", desc: "Podświetla zasięg walki", url: "https://besiak6.github.io/scripts/baddonz/zw.js", icon: "fa-arrows-to-circle" },
        ZAP: { name: "Szybka Grupa", desc: "Zapraszanie do grupy", url: "https://besiak6.github.io/scripts/addons/testsg.js", icon: "fa-user-plus", wnd: true, windowId: "zap-wnd" },
        AP: { name: "Auto Przywo", desc: "Automatyczna akceptacja przywołań", url: "https://besiak6.github.io/scripts/addons/test.js", icon: "fa-rocket", wnd: true, windowId: "ap-wnd" },
        AX: { name: "AutoX", desc: "Automatyczne atakowanie", url: "https://besiak6.github.io/scripts/addons/testax.js", icon: "fa-skull-crossbones", wnd: true, settings: true, windowId: "baddonz-ax-wnd", settingswnd: "baddonz-ax-wnd-settings" },
        TRASH: { name: "Śmieciara", desc: "Niszczenie itemów", url: "https://besiak6.github.io/scripts/baddonz/trash.js", icon: "fa-trash-can" },
        SC: { name: "Sleeping Commander", desc: "Oddaje d", url: "https://besiak6.github.io/scripts/baddonz/oddajd.js", icon: "fa-bed" }
    };
    let globalData = {};
    let managerState = {};
    const loadedAddonScripts = {};
    const registeredAddonCallbacks = {};

    let managerWindow, collapseButtonEl, windowBodyEl, toggleHotkeyInputEl, resetHotkeyInputEl;
    let isManagerInitialized = false;
    let cachedDockWrapper = null, cachedDock = null, cachedDockSwitch = null;

    const loadState = () => {
        const accId = window.BaddonzAPI.accountId;
        const charId = window.BaddonzAPI.charId;
        globalData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

        const defaultManagerState = {
            activeTab: "addons", isCollapsed: false, currentOpacity: 2, closeButtonEnabled: false,
            searchEnabled: true, isManagerVisible: true, addonStates: {}, toggleHotkey: 'shift+b',
            blurBackgroundEnabled: false, unifiedOpacityEnabled: false, resetPositionHotkey: 'shift+meta+b',
            dockEnabled: true, dockPosition: 'top-right', isDockHorizontal: false, dockCollapsed: false,
            positions: { "baddonz-manager-window": { left: '0px', top: '0px' } }
        };

        if (!globalData[accId]) globalData[accId] = { manager: { ...defaultManagerState }, addons: {} };
        if (!globalData[accId].addons) globalData[accId].addons = {};
        if (!globalData[accId].addons[charId]) globalData[accId].addons[charId] = {};

        managerState = { ...defaultManagerState, ...globalData[accId].manager };
        managerState.addonStates = { ...defaultManagerState.addonStates, ...(globalData[accId].manager.addonStates || {}) };
        managerState.positions = { ...defaultManagerState.positions, ...(globalData[accId].manager.positions || {}) };

        Object.keys(ADDONS).forEach(key => { if (managerState.addonStates[key] === undefined) managerState.addonStates[key] = false; });
    };

    const saveState = () => {
        const accId = window.BaddonzAPI.accountId;
        if (!globalData[accId]) globalData[accId] = { addons: {} };
        globalData[accId].manager = managerState;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(globalData));
    };

    window.BaddonzAPI = {
        accountId: null,
        charId: null,

        isValidHotkey: function(key) {
            return key.length === 1 && key !== ' ';
        },

        getAddonSettings: function(addonKey) {
            return globalData[this.accountId]?.addons?.[this.charId]?.[addonKey] || {};
        },
        saveAddonSettings: function(addonKey, addonData) {
            if (!globalData[this.accountId]) globalData[this.accountId] = { manager: managerState, addons: {} };
            if (!globalData[this.accountId].addons) globalData[this.accountId].addons = {};
            if (!globalData[this.accountId].addons[this.charId]) globalData[this.accountId].addons[this.charId] = {};

            globalData[this.accountId].addons[this.charId][addonKey] = addonData;
            saveState();
        },

        createAddonWindow: function(addonId, title, bodyHtmlString, options = {}) {
            const cfg = this.getAddonSettings(addonId);
            const wndId = options.customId || `baddonz-${addonId.toLowerCase()}-wnd`;

            const initialOpacity = managerState.unifiedOpacityEnabled ? managerState.currentOpacity : (cfg.windowOpacity || 2);
            const blurClass = managerState.blurBackgroundEnabled ? 'blur' : '';
            const displayStyle = (cfg.windowVisible !== false) ? 'flex' : 'none';

            const widthStyle = options.width ? `width: ${options.width};` : '';
            const heightStyle = options.height ? `height: ${options.height};` : '';

            let leftControls = `<div class="baddonz-icon baddonz-opacity-button"></div>`;
            if (options.hasSettings) leftControls += `<div class="baddonz-icon baddonz-settings-button"></div>`;

            let rightControls = ``;
            if (options.hasCollapse) rightControls += `<div class="baddonz-icon baddonz-collapsed"></div>`;
            if (options.hasClose !== false) rightControls += `<div class="baddonz-icon baddonz-close-button"></div>`;

            const windowHtml = `
                <div class="baddonz-window ${wndId} opacity-${initialOpacity} ${blurClass}" data-window-id="${wndId}" data-addon-id="${addonId}" style="position: absolute; display: ${displayStyle}; z-index: 11; ${widthStyle} ${heightStyle}">
                    <div class="baddonz-window-header">
                        <div class="baddonz-window-controls left">
                            ${leftControls}
                        </div>
                        <div class="baddonz-window-title">${title}</div>
                        <div class="baddonz-window-controls right">
                            ${rightControls}
                        </div>
                    </div>
                    <div class="baddonz-window-body baddonz-flex column" style="gap: 5px;">
                        ${bodyHtmlString}
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', windowHtml);
            const wnd = document.querySelector(`.${wndId}`);

            if (managerState.positions[wndId]) {
                wnd.style.left = managerState.positions[wndId].left;
                wnd.style.top = managerState.positions[wndId].top;
            } else {
                wnd.style.left = '0px'; wnd.style.top = '0px';
            }

            if(wnd) {
                attachZIndexListener(wnd);
                if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                    const btnClose = wnd.querySelector('.baddonz-close-button');
                    const btnOpacity = wnd.querySelector('.baddonz-opacity-button');
                    const btnSettings = wnd.querySelector('.baddonz-settings-button');

                    if (btnClose) $(btnClose).tip(TOOLTIP_TEXTS.closeButton);
                    if (btnOpacity) $(btnOpacity).tip(TOOLTIP_TEXTS.opacityButton);
                    if (btnSettings) $(btnSettings).tip(TOOLTIP_TEXTS.addonSettingsWindow);
                }
            }
            return wnd;
        },

        registerAddon: function(addonId, callbacks) {
            registeredAddonCallbacks[addonId] = callbacks;
            if (managerState.addonStates[addonId] && typeof callbacks.init === 'function') {
                callbacks.init();
            }
        }
    };

    const createElement = (tag, attrs = {}, ...children) => {
        const el = document.createElement(tag);
        for (const [key, value] of Object.entries(attrs)) {
            if (key === 'className') el.className = value; else if (key === 'style') el.style.cssText = value; else if (key === 'dataset') Object.entries(value).forEach(([k, v]) => el.dataset[k] = v); else if (key.startsWith('on') && typeof value === 'function') el[key] = value; else el.setAttribute(key, value);
        }
        children.forEach(child => { if (typeof child === 'string') el.appendChild(document.createTextNode(child)); else if (child instanceof Node) el.appendChild(child); }); return el;
    };

    window.setBaddonzGlobalOpacity = (opacityValue) => { if (typeof opacityValue !== 'number' || opacityValue < 0 || opacityValue > 4) return; managerState.currentOpacity = opacityValue; saveState(); updateAllWindowsOpacity(); };
    const isChatFocused = () => { const el = document.activeElement; return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable); };
    const injectStyles = (url) => { if (document.querySelector('.baddonz-styles-global')) return; fetch(url).then(res => res.text()).then(css => document.head.appendChild(createElement('style', { className: 'baddonz-styles-global' }, css))).catch(() => {}); };
    const injectDockFixes = () => { if (document.querySelector('.baddonz-dock-fixes')) return; const fixCss = `.baddonz-dock-wrapper .baddonz-dock { transition: max-height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), max-width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease, padding 0.3s ease !important; overflow: hidden !important; } .baddonz-dock-wrapper.vertical .baddonz-dock.collapsed { max-height: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; opacity: 0 !important; border: none !important; } .baddonz-dock-wrapper.horizontal .baddonz-dock.collapsed { max-width: 0 !important; padding-left: 0 !important; padding-right: 0 !important; opacity: 0 !important; border: none !important; }`; document.head.appendChild(createElement('style', { className: 'baddonz-dock-fixes' }, fixCss)); };
    const addFontAwesome = () => { if (document.querySelector('.font-awesome-baddonz')) return; document.head.appendChild(createElement('link', { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css', className: 'font-awesome-baddonz' })); };

    const clampWindowPosition = (wnd) => { if (!wnd) return; let newLeft = Math.max(0, Math.min(wnd.offsetLeft, window.innerWidth - wnd.offsetWidth)); let newTop = Math.max(0, Math.min(wnd.offsetTop, window.innerHeight - wnd.offsetHeight)); wnd.style.left = `${newLeft}px`; wnd.style.top = `${newTop}px`; };
    const bringWindowToFront = (wnd) => { document.querySelectorAll('.baddonz-window').forEach(w => { w.style.zIndex = '11'; }); if (wnd) wnd.style.zIndex = '12'; };
    const attachZIndexListener = (wnd) => { if (wnd.__baddonzZIndexAttached) return; wnd.__baddonzZIndexAttached = true; wnd.addEventListener('mousedown', (e) => { if (e.target.closest('.baddonz-window-controls, .baddonz-tab, .baddonz-checkbox, .baddonz-input, .rg-keybind-input')) return; bringWindowToFront(wnd); }); };
    const formatHotkeyDisplay = (hotkey) => { if (!hotkey) return ""; return hotkey.split('+').map(p => ({ 'control': 'Ctrl', 'shift': 'Shift', 'alt': 'Alt', 'meta': 'WIN (Meta/Cmd)', ' ': '[SPACJA]' }[p] || p.toUpperCase())).join(' + '); };

    const initGlobalScroll = () => {
        document.addEventListener('wheel', (e) => {
            const scrollArea = e.target.closest('.baddonz-scroll');
            if (scrollArea) { e.preventDefault(); scrollArea.scrollTop += e.deltaY; }
        }, { passive: false });
    };

    const initGlobalWindowControls = () => {
        document.addEventListener('mousedown', (e) => {
            const header = e.target.closest('.baddonz-window-header');
            if (!header) return;
            const wnd = header.closest('.baddonz-window');
            if (!wnd || e.target.closest('.baddonz-window-controls, .baddonz-tab')) return;
            let isDragging = true; let offsetX = e.clientX - wnd.offsetLeft; let offsetY = e.clientY - wnd.offsetTop;
            const onMouseMove = (moveEvent) => { if (!isDragging) return; wnd.style.left = `${moveEvent.clientX - offsetX}px`; wnd.style.top = `${moveEvent.clientY - offsetY}px`; clampWindowPosition(wnd); };
            const onMouseUp = () => { isDragging = false; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); const wndId = wnd.dataset.windowId; if (wndId) { managerState.positions[wndId] = { left: wnd.style.left, top: wnd.style.top }; saveState(); } };
            document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
        });

        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.baddonz-close-button');
            if (closeBtn) {
                if(closeBtn.closest('.baddonz-list-item')) return;
                const wnd = closeBtn.closest('.baddonz-window');
                if (wnd && !wnd.classList.contains('baddonz-manager-window')) {
                    wnd.style.display = 'none';
                    const addonId = wnd.dataset.addonId;
                    if (addonId) {
                        let cfg = window.BaddonzAPI.getAddonSettings(addonId);
                        if (wnd.classList.contains('settings-window')) cfg.settingsWindowVisible = false;
                        else { cfg.windowVisible = false; refreshDockIcons(); }
                        window.BaddonzAPI.saveAddonSettings(addonId, cfg);
                    }
                }
                return;
            }

            const opacityBtn = e.target.closest('.baddonz-opacity-button');
            if (opacityBtn) {
                const wnd = opacityBtn.closest('.baddonz-window');
                if (wnd && !wnd.classList.contains('baddonz-manager-window')) {
                    if (managerState.unifiedOpacityEnabled) {
                        window.setBaddonzGlobalOpacity((parseInt(managerState.currentOpacity) + 1) % 5);
                    } else {
                        let currentOp = 2;
                        for (let i = 0; i < 5; i++) { if (wnd.classList.contains(`opacity-${i}`)) { currentOp = i; wnd.classList.remove(`opacity-${i}`); break; } }
                        let newOp = (currentOp + 1) % 5; wnd.classList.add(`opacity-${newOp}`);
                        const addonId = wnd.dataset.addonId;
                        if (addonId) {
                            let cfg = window.BaddonzAPI.getAddonSettings(addonId);
                            if (wnd.classList.contains('settings-window')) cfg.windowSettingsOpacity = newOp;
                            else cfg.windowOpacity = newOp;
                            window.BaddonzAPI.saveAddonSettings(addonId, cfg);
                        }
                    }
                }
                return;
            }
        });
    };

    async function loadAddonScript(key, url) {
        if (loadedAddonScripts[key]) {
            if (registeredAddonCallbacks[key] && typeof registeredAddonCallbacks[key].init === 'function') {
                registeredAddonCallbacks[key].init();
            }
            return;
        }
        try {
            const script = createElement('script', { src: url, className: `baddonz-addon-script-${key}` });
            document.head.appendChild(script);
            await new Promise((resolve, reject) => { script.onload = () => { loadedAddonScripts[key] = script; resolve(); }; script.onerror = (e) => { script.remove(); delete loadedAddonScripts[key]; reject(e); }; });
        } catch (error) {}
    }

    function unloadAddonScript(key) {
        if (registeredAddonCallbacks[key] && typeof registeredAddonCallbacks[key].stop === 'function') {
            registeredAddonCallbacks[key].stop();
        }
        const wndId = `baddonz-${key.toLowerCase()}-wnd`;
        const wnd = document.querySelector(`.${wndId}`) || document.querySelector(`[data-addon-id="${key}"]`);
        if (wnd) wnd.style.display = 'none';

        const setWndId = `baddonz-${key.toLowerCase()}-wnd-settings`;
        const setWnd = document.querySelector(`.${setWndId}`);
        if (setWnd) setWnd.style.display = 'none';
    }

    function toggleWindowVisibility() { if (!managerWindow) buildUI(); if (managerWindow) { const isVisible = managerWindow.style.display !== 'none'; managerWindow.style.display = isVisible ? 'none' : 'flex'; managerState.isManagerVisible = !isVisible; saveState(); if (!isVisible) { clampWindowPosition(managerWindow); bringWindowToFront(managerWindow); } } }
    function toggleWindowCollapse() { managerState.isCollapsed = !managerState.isCollapsed; if (managerWindow) { managerWindow.classList.toggle('collapsed', managerState.isCollapsed); windowBodyEl.style.display = managerState.isCollapsed ? 'none' : 'flex'; if (!managerState.isCollapsed) { managerWindow.style.width = '380px'; managerWindow.style.height = '450px'; } clampWindowPosition(managerWindow); updateCollapseButtonTip(); saveState(); } }
    function changeWindowOpacity() { managerState.currentOpacity = (managerState.currentOpacity + 1) % 5; saveState(); if (managerState.unifiedOpacityEnabled) updateAllWindowsOpacity(); else if (managerWindow) { for (let i = 0; i < 5; i++) managerWindow.classList.remove(`opacity-${i}`); managerWindow.classList.add(`opacity-${managerState.currentOpacity}`); } }
    function updateAllWindowsOpacity() { document.querySelectorAll('.baddonz-window').forEach(wnd => { for (let i = 0; i < 5; i++) wnd.classList.remove(`opacity-${i}`); wnd.classList.add(`opacity-${managerState.currentOpacity}`); }); }
    function updateAllWindowsBlurState() { document.querySelectorAll('.baddonz-window').forEach(wnd => wnd.classList.toggle('blur', managerState.blurBackgroundEnabled)); }
    function resetAllWindowPositions() { document.querySelectorAll('.baddonz-window').forEach(wnd => { wnd.style.left = '0px'; wnd.style.top = '0px'; }); managerState.positions = { "baddonz-manager-window": { left: '0px', top: '0px' } }; saveState(); }
    function resetAllBaddonzSettings() { localStorage.removeItem(STORAGE_KEY); alert('Wszystkie ustawienia zostały zresetowane. Odśwież stronę.'); window.location.reload(); }

    const handleGlobalKeyDown = (e) => {
        const handleHotkeySetting = (stateKey, inputEl, modeKey) => {
            e.preventDefault(); e.stopPropagation();
            const modifiers = [];
            if (e.ctrlKey) modifiers.push('control');
            if (e.shiftKey) modifiers.push('shift');
            if (e.altKey) modifiers.push('alt');
            if (e.metaKey) modifiers.push('meta');
            let key = e.key.toLowerCase();

            const specialKeys = ['escape', 'enter', 'tab', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', ' '];
            if (['control', 'shift', 'alt', 'meta', ...specialKeys].includes(key)) {
                if (modifiers.length === 1 && modifiers[0] === key) return;
                if (modifiers.length === 0) return;
            }

            let newHotkeyParts = [...new Set(modifiers)].sort();
            if (!['control', 'shift', 'alt', 'meta'].includes(key)) newHotkeyParts.push(key);
            const newHotkey = newHotkeyParts.join('+');

            if (newHotkey && newHotkeyParts.some(part => !['control', 'shift', 'alt', 'meta'].includes(part) || newHotkeyParts.length > 1)) {
                managerState[stateKey] = newHotkey;
                saveState();
                if (inputEl) {
                    inputEl.value = formatHotkeyDisplay(newHotkey);
                    inputEl.classList.remove('active-keybind-mode');
                    inputEl.blur();
                }
                managerState[modeKey] = false;
            }
        };

        if (managerState.isHotkeySettingMode) return handleHotkeySetting('toggleHotkey', toggleHotkeyInputEl, 'isHotkeySettingMode');
        if (managerState.isResetHotkeySettingMode) return handleHotkeySetting('resetPositionHotkey', resetHotkeyInputEl, 'isResetHotkeySettingMode');

        if (!isChatFocused()) {
            const checkHotkeyMatch = (hotkey) => {
                if (!hotkey) return false;
                const parts = hotkey.split('+');
                return (e.ctrlKey === parts.includes('control')) && (e.shiftKey === parts.includes('shift')) && (e.altKey === parts.includes('alt')) && (e.metaKey === parts.includes('meta')) && (e.key.toLowerCase() === parts[parts.length - 1]);
            };
            if (checkHotkeyMatch(managerState.toggleHotkey)) { e.preventDefault(); toggleWindowVisibility(); }
            else if (checkHotkeyMatch(managerState.resetPositionHotkey)) { e.preventDefault(); resetAllWindowPositions(); }
        }
    };

    function updateCollapseButtonTip() { if (!collapseButtonEl || managerState.closeButtonEnabled) return; $(collapseButtonEl).tip(managerState.isCollapsed ? TOOLTIP_TEXTS.collapseButtonCollapsed : TOOLTIP_TEXTS.collapseButtonExpanded); }
    function updateCloseButtonBehavior() { if (!collapseButtonEl) return; collapseButtonEl.classList.remove('baddonz-collapsed', 'baddonz-close-button'); if (managerState.closeButtonEnabled) { collapseButtonEl.classList.add('baddonz-close-button'); $(collapseButtonEl).tip(TOOLTIP_TEXTS.closeButton); collapseButtonEl.onclick = () => { if (managerWindow) managerWindow.style.display = 'none'; managerState.isManagerVisible = false; saveState(); }; } else { collapseButtonEl.classList.add('baddonz-collapsed'); collapseButtonEl.onclick = toggleWindowCollapse; updateCollapseButtonTip(); } }
    function filterAddons(query) { const queryLower = query.toLowerCase(); document.querySelectorAll('.baddonz-card').forEach(card => { const addonInfo = ADDONS[card.dataset.addonKey]; const matches = query === '' || addonInfo.name.toLowerCase().includes(queryLower) || addonInfo.desc.toLowerCase().includes(queryLower) || card.dataset.addonKey.toLowerCase().includes(queryLower); card.style.display = matches ? 'flex' : 'none'; }); }

    function renderAddonsTab(container) {
        container.innerHTML = '';
        if (managerState.searchEnabled) { const searchInput = createElement('input', { type: 'text', placeholder: TOOLTIP_TEXTS.search, className: 'baddonz-input', style: 'width:100%; padding:5px 5px 5px 30px;', oninput: (e) => filterAddons(e.target.value) }); const searchIcon = createElement('i', { className: 'fas fa-magnifying-glass', style: 'position:absolute; left:10px; color:#777; pointer-events:none;' }); const searchWrapper = createElement('div', { style: 'position:relative; flex:1; display:flex; align-items:center;' }, searchIcon, searchInput); const searchContainer = createElement('div', { className: 'baddonz-search-container', style: 'display:flex; justify-content:space-between; align-items:center; gap:5px; padding-bottom:5px; border-bottom:1px solid #444; width:100%; box-sizing:border-box;' }, searchWrapper); container.appendChild(searchContainer); }
        const addonsList = createElement('div', { className: 'column baddonz-box', style: 'display:flex; flex-direction:column; gap:5px; padding:5px 10px 10px 10px; flex:1; overflow-y:auto; background:none;' });
        addonsList.addEventListener('wheel', (e) => { e.preventDefault(); addonsList.scrollTop += e.deltaY; }, { passive: false });

        Object.keys(ADDONS).forEach(key => {
            const addon = ADDONS[key];
            const checkbox = createElement('div', { className: `baddonz-checkbox baddonz-addon-toggle ${managerState.addonStates[key] ? 'active' : ''}` });
            checkbox.classList.add(`baddonz-toggle-${key}`);
            const nameSpan = createElement('span', { style: 'margin-left:10px;' }, addon.name);
            const buttonsContainer = createElement('div', { className: 'baddonz-addon-buttons', style: `margin-left:auto; display:${managerState.addonStates[key] ? 'flex' : 'none'}; gap:5px; align-items:center;` });

            if (addon.settings && addon.settingswnd) {
                const settingsBtn = createElement('div', { className: 'baddonz-settings-button baddonz-icon', onclick: (e) => {
                    e.stopPropagation();
                    const wndId = addon.settingswnd || `baddonz-${key.toLowerCase()}-wnd-settings`;
                    const wnd = document.querySelector(`.${wndId}`);
                    if (wnd) {
                        const isVisible = wnd.style.display === 'block' || wnd.style.display === 'flex';
                        wnd.style.display = isVisible ? 'none' : 'flex';
                        if (!isVisible) bringWindowToFront(wnd);

                        let cfg = window.BaddonzAPI.getAddonSettings(key);
                        cfg.settingsWindowVisible = !isVisible;
                        window.BaddonzAPI.saveAddonSettings(key, cfg);
                    }
                }});
                $(settingsBtn).tip(TOOLTIP_TEXTS.addonSettingsWindow);
                buttonsContainer.appendChild(settingsBtn);
            }

            if (addon.wnd) {
                const wndBtn = createElement('div', { className: 'baddonz-enable-wnd baddonz-icon', style: 'margin-top:5px;', onclick: (e) => {
                    e.stopPropagation();
                    const wndId = addon.windowId || `baddonz-${key.toLowerCase()}-wnd`;
                    const wnd = document.querySelector(`.${wndId}`) || document.querySelector(`[data-addon-id="${key}"]`);

                    if (wnd) {
                        const isVisible = wnd.style.display === 'block' || wnd.style.display === 'flex';
                        wnd.style.display = isVisible ? 'none' : 'flex';
                        if (!isVisible) bringWindowToFront(wnd);
                        let cfg = window.BaddonzAPI.getAddonSettings(key);
                        cfg.windowVisible = !isVisible;
                        window.BaddonzAPI.saveAddonSettings(key, cfg);
                        refreshDockIcons();
                    }
                }});
                $(wndBtn).tip(TOOLTIP_TEXTS.addonWindow);
                buttonsContainer.appendChild(wndBtn);
            }

            const titleRow = createElement('div', { className: 'baddonz-card-title baddonz-flex baddonz-align-center', style: 'width:100%;' }, checkbox, nameSpan, buttonsContainer);
            const descParagraph = createElement('p', { className: 'baddonz-text', style: 'margin-top:2px; margin-bottom:0; font-size:11px; color:#ccc;' }); descParagraph.innerHTML = addon.desc;
            const card = createElement('div', { className: `baddonz-card baddonz-flex column ${managerState.addonStates[key] ? 'active-addon' : ''}`, style: 'max-height:80px; width:100%; margin-bottom:5px;', dataset: { addonKey: key } }, titleRow, descParagraph);

            checkbox.onclick = async () => {
                managerState.addonStates[key] = !managerState.addonStates[key];
                checkbox.classList.toggle('active', managerState.addonStates[key]);
                card.classList.toggle('active-addon', managerState.addonStates[key]);
                buttonsContainer.style.display = managerState.addonStates[key] ? 'flex' : 'none';
                saveState();

                if (!managerState.addonStates[key]) { unloadAddonScript(key); }
                else { await loadAddonScript(key, addon.url); }
                refreshDockIcons();
            };
            addonsList.appendChild(card);
        });
        container.appendChild(addonsList);
    }

    function renderSettingsTab(container) {
        container.innerHTML = ''; const settingsContent = createElement('div', { className: 'baddonz-box', style: 'display:flex; flex-direction:column; padding:10px; margin:0; flex:1; overflow-y:auto; background:none;' }); settingsContent.addEventListener('wheel', (e) => { e.preventDefault(); settingsContent.scrollTop += e.deltaY; }, { passive: false });
        const createSettingRow = (labelText, state, onClick, tooltip = null) => { const checkbox = createElement('div', { className: `baddonz-checkbox ${state ? 'active' : ''}` }); checkbox.onclick = () => onClick(checkbox); if (tooltip) $(checkbox).tip(tooltip); const label = createElement('span', { className: 'baddonz-label baddonz-text', style: 'margin:0; padding:0; line-height:normal;' }, labelText); if (tooltip) $(label).tip(tooltip); return createElement('div', { className: 'baddonz-setting-row', style: 'display:flex; flex-direction:row; width:100%; justify-content:flex-start; align-items:center; gap:10px; background:none; margin:0 0 7px 0; padding:0; line-height:normal;' }, checkbox, label); };

        settingsContent.appendChild(createSettingRow("Przycisk Zamykania (Esc)", managerState.closeButtonEnabled, (cb) => { managerState.closeButtonEnabled = !managerState.closeButtonEnabled; cb.classList.toggle('active', managerState.closeButtonEnabled); saveState(); updateCloseButtonBehavior(); }));
        settingsContent.appendChild(createSettingRow("Wyszukiwarka", managerState.searchEnabled, (cb) => { managerState.searchEnabled = !managerState.searchEnabled; cb.classList.toggle('active', managerState.searchEnabled); saveState(); if (managerState.activeTab === 'addons') renderAddonsTab(document.querySelector('.baddonz-tab-content-area')); }, "Wyszukiwarka dodatków"));
        settingsContent.appendChild(createSettingRow("Rozmazuj tło", managerState.blurBackgroundEnabled, (cb) => { managerState.blurBackgroundEnabled = !managerState.blurBackgroundEnabled; cb.classList.toggle('active', managerState.blurBackgroundEnabled); saveState(); updateAllWindowsBlurState(); }, TOOLTIP_TEXTS.blurBackground));
        settingsContent.appendChild(createSettingRow("Jednakowa przezroczystość", managerState.unifiedOpacityEnabled, (cb) => { managerState.unifiedOpacityEnabled = !managerState.unifiedOpacityEnabled; cb.classList.toggle('active', managerState.unifiedOpacityEnabled); saveState(); updateAllWindowsOpacity(); }, TOOLTIP_TEXTS.unifiedOpacity));
        settingsContent.appendChild(createSettingRow("Dock", managerState.dockEnabled, (cb) => { managerState.dockEnabled = !managerState.dockEnabled; cb.classList.toggle('active', managerState.dockEnabled); saveState(); toggleDock(); document.querySelectorAll('.dock-dep-row').forEach(row => row.style.display = managerState.dockEnabled ? 'flex' : 'none'); }, TOOLTIP_TEXTS.dock));

        const dockPosSelect = createElement('select', { className: 'baddonz-input baddonz-select', style: 'flex-grow:1;', onchange: () => { managerState.dockPosition = dockPosSelect.value; saveState(); updateDockPosition(); }}); dockPosSelect.innerHTML = `<option value="bottom-right">Prawo Dół</option><option value="top-right">Prawo Góra</option><option value="bottom-left">Lewo Dół</option><option value="top-left">Lewo Góra</option>`; dockPosSelect.value = managerState.dockPosition; settingsContent.appendChild(createElement('div', { className: 'baddonz-setting-row dock-dep-row', style: `display:${managerState.dockEnabled ? 'flex' : 'none'}; flex-direction:row; width:100%; justify-content:space-between; align-items:center; gap:10px; margin:5px 0 10px 0;` }, createElement('span', { className: 'baddonz-label baddonz-text', style: 'white-space:nowrap;' }, "Pozycja Docka:"), dockPosSelect));
        const dockHorizRow = createSettingRow("Dock Poziomo", managerState.isDockHorizontal, (cb) => { managerState.isDockHorizontal = !managerState.isDockHorizontal; cb.classList.toggle('active', managerState.isDockHorizontal); saveState(); updateDockPosition(); }); dockHorizRow.classList.add('dock-dep-row'); dockHorizRow.style.display = managerState.dockEnabled ? 'flex' : 'none'; settingsContent.appendChild(dockHorizRow);

        let lastRightClickToggle = 0; toggleHotkeyInputEl = createElement('input', { type: 'text', className: 'baddonz-input baddonz-toggle-hotkey-input', readOnly: true, value: formatHotkeyDisplay(managerState.toggleHotkey), style: 'text-align:center; padding:4px 6px; box-sizing:border-box; flex-grow:1;' }); $(toggleHotkeyInputEl).tip(`${TOOLTIP_TEXTS.toggleManagerHotkey} | ${TOOLTIP_TEXTS.hotkeyResetTip}`); toggleHotkeyInputEl.onclick = () => { managerState.isHotkeySettingMode = true; toggleHotkeyInputEl.classList.add('active-keybind-mode'); toggleHotkeyInputEl.focus(); }; toggleHotkeyInputEl.onblur = () => { managerState.isHotkeySettingMode = false; toggleHotkeyInputEl.classList.remove('active-keybind-mode'); toggleHotkeyInputEl.value = formatHotkeyDisplay(managerState.toggleHotkey); }; toggleHotkeyInputEl.oncontextmenu = (e) => { e.preventDefault(); const now = Date.now(); if (now - lastRightClickToggle < 300) { managerState.toggleHotkey = 'shift+b'; saveState(); toggleHotkeyInputEl.value = formatHotkeyDisplay('shift+b'); toggleHotkeyInputEl.classList.remove('active-keybind-mode'); managerState.isHotkeySettingMode = false; } lastRightClickToggle = now; }; settingsContent.appendChild(createElement('div', { className: 'baddonz-setting-row', style: 'display:flex; justify-content:space-between; align-items:center; gap:10px; margin:5px 0 10px 0; width:100%;' }, createElement('span', { className: 'baddonz-label baddonz-text' }, "Otwieraj Managera:"), toggleHotkeyInputEl));

        const resetBtnRow = createElement('div', { className: 'baddonz-setting-row', style: 'display:flex; justify-content:flex-start; align-items:center; gap:10px; margin-bottom:7px; width:100%;' }, createElement('span', { className: 'baddonz-label baddonz-text' }, "Resetuj Pozycje wszystkich okienek"), createElement('div', { className: 'baddonz-button', style: 'margin-left:auto; flex-shrink:0;', onclick: resetAllWindowPositions }, "Resetuj") ); $(resetBtnRow.children[1]).tip(TOOLTIP_TEXTS.resetPositions); settingsContent.appendChild(resetBtnRow);
        let lastRightClickReset = 0; resetHotkeyInputEl = createElement('input', { type: 'text', className: 'baddonz-input baddonz-reset-hotkey-input', readOnly: true, value: formatHotkeyDisplay(managerState.resetPositionHotkey), style: 'text-align:center; padding:4px 6px; box-sizing:border-box; flex-grow:1;' }); $(resetHotkeyInputEl).tip(`${TOOLTIP_TEXTS.resetHotkey} | ${TOOLTIP_TEXTS.hotkeyResetTip}`); resetHotkeyInputEl.onclick = () => { managerState.isResetHotkeySettingMode = true; resetHotkeyInputEl.classList.add('active-keybind-mode'); resetHotkeyInputEl.focus(); }; resetHotkeyInputEl.onblur = () => { managerState.isResetHotkeySettingMode = false; resetHotkeyInputEl.classList.remove('active-keybind-mode'); resetHotkeyInputEl.value = formatHotkeyDisplay(managerState.resetPositionHotkey); }; resetHotkeyInputEl.oncontextmenu = (e) => { e.preventDefault(); const now = Date.now(); if (now - lastRightClickReset < 300) { managerState.resetPositionHotkey = 'shift+meta+b'; saveState(); resetHotkeyInputEl.value = formatHotkeyDisplay('shift+meta+b'); resetHotkeyInputEl.classList.remove('active-keybind-mode'); managerState.isResetHotkeySettingMode = false; } lastRightClickReset = now; }; settingsContent.appendChild(createElement('div', { className: 'baddonz-setting-row', style: 'display:flex; justify-content:space-between; align-items:center; gap:10px; margin:5px 0 10px 0; width:100%;' }, createElement('span', { className: 'baddonz-label baddonz-text', style: 'white-space:nowrap;' }, "Skrót Resetu:"), resetHotkeyInputEl));
        const hardResetBtn = createElement('div', { className: 'baddonz-button', onclick: () => { if (confirm('Zresetować wszystko?')) resetAllBaddonzSettings(); } }, "Resetuj Wszystkie Ustawienia"); $(hardResetBtn).tip('Resetuje całkowicie manager i dodatki'); settingsContent.appendChild(createElement('div', { className: 'baddonz-setting-row', style: 'display:flex; justify-content:center; width:100%; margin-top:15px; border-top:1px solid #444; padding-top:10px;' }, hardResetBtn));
        container.appendChild(settingsContent);
    }

    function refreshDockIcons() {
        if (!cachedDockWrapper) return;
        cachedDockWrapper.querySelectorAll('.baddonz-dock-addon').forEach(dockAddon => {
            const key = dockAddon.dataset.addonKey;
            const addon = ADDONS[key];
            if (managerState.addonStates[key]) {
                dockAddon.style.display = 'flex';

                let isVisible = false;
                if (addon && addon.windowId) {
                    const wndId = addon.windowId || `baddonz-${key.toLowerCase()}-wnd`;
                    const wnd = document.querySelector(`.${wndId}`) || document.querySelector(`[data-addon-id="${key}"]`);
                    isVisible = wnd && wnd.style.display !== 'none';
                    dockAddon.classList.toggle('active', isVisible);
                }

                let cfg = window.BaddonzAPI.getAddonSettings(key);
                let isEnabled = cfg.enabled !== false;

                let lpmText = isVisible ? "LPM: Ukryj Okno" : "LPM: Pokaż Okno";
                let ppmText = isEnabled
                    ? "PPM: Stan <span style='color:#ff5555'>OFF</span>"
                    : "PPM: Stan <span style='color:#55ff55'>ON</span>";

                if (typeof $ === 'function' && typeof $.fn.tip === 'function') {
                    $(dockAddon).tip(`${addon.name}<br><span style="color:#aaa; font-size:10px;">${lpmText}<br>${ppmText}</span>`);
                }

            } else {
                dockAddon.style.display = 'none';
            }
        });
    }

    function createDock() {
        if (cachedDockWrapper || document.querySelector('.baddonz-dock-wrapper')) return; addFontAwesome(); const gameLayer = document.querySelector('.game-layer.ui-droppable'); if (!gameLayer) return;
        const orientationClass = managerState.isDockHorizontal ? 'horizontal' : 'vertical'; cachedDockSwitch = createElement('div', { className: 'baddonz-dock-switch' }, createElement('i', { className: 'fa fa-chevron-left' })); cachedDock = createElement('div', { className: `baddonz-dock collapsed ${orientationClass}` });

        Object.keys(ADDONS).forEach(key => {
            const addon = ADDONS[key];
            if (addon.wnd) {
                const icon = createElement('i', { className: `fa-solid ${addon.icon || 'fa-question'}` });
                const dockAddon = createElement('div', { className: 'baddonz-dock-addon', dataset: { addonKey: key } }, icon);

                dockAddon.onclick = (e) => {
                    if (e.button === 0) {
                        const wndId = addon.windowId || `baddonz-${key.toLowerCase()}-wnd`;
                        const wnd = document.querySelector(`.${wndId}`) || document.querySelector(`[data-addon-id="${key}"]`);
                        if (wnd) {
                            const isVisible = wnd.style.display !== 'none'; wnd.style.display = isVisible ? 'none' : 'flex';
                            if (!isVisible) bringWindowToFront(wnd); dockAddon.classList.toggle('active', !isVisible);
                            let cfg = window.BaddonzAPI.getAddonSettings(key); cfg.windowVisible = !isVisible; window.BaddonzAPI.saveAddonSettings(key, cfg);
                            refreshDockIcons();
                        }
                    }
                };

                dockAddon.oncontextmenu = (e) => {
                    e.preventDefault();
                    let cfg = window.BaddonzAPI.getAddonSettings(key);

                    cfg.enabled = cfg.enabled === false ? true : false;
                    window.BaddonzAPI.saveAddonSettings(key, cfg);

                    if (registeredAddonCallbacks[key] && typeof registeredAddonCallbacks[key].onStateToggle === 'function') {
                        registeredAddonCallbacks[key].onStateToggle(cfg.enabled);
                    }
                    refreshDockIcons();
                };

                cachedDock.appendChild(dockAddon);
            }
        });
        cachedDockWrapper = createElement('div', { className: `baddonz-dock-wrapper ${managerState.dockPosition} ${orientationClass}` }, cachedDockSwitch, cachedDock); gameLayer.appendChild(cachedDockWrapper);
        if (!managerState.dockCollapsed) { cachedDock.classList.remove('collapsed'); cachedDockSwitch.classList.add('active'); }

        $(cachedDockSwitch).tip(`Baddonz<br><span style="color:#aaa; font-size:10px;">PPM: Otwórz Managera</span>`);
        cachedDockSwitch.onclick = () => { managerState.dockCollapsed = cachedDock.classList.toggle('collapsed'); cachedDockSwitch.classList.toggle('active', !managerState.dockCollapsed); saveState(); };
        cachedDockSwitch.oncontextmenu = (e) => { e.preventDefault(); toggleWindowVisibility(); };

        refreshDockIcons();
    }
    function removeDock() { if (cachedDockWrapper) { cachedDockWrapper.remove(); cachedDockWrapper = null; cachedDock = null; cachedDockSwitch = null; } }
    function toggleDock() { if (managerState.dockEnabled) createDock(); else removeDock(); }
    function updateDockPosition() { if (cachedDockWrapper) { ['bottom-right', 'top-right', 'bottom-left', 'top-left'].forEach(pos => cachedDockWrapper.classList.remove(pos)); cachedDockWrapper.classList.add(managerState.dockPosition); const orientation = managerState.isDockHorizontal ? 'horizontal' : 'vertical'; const oppOrientation = managerState.isDockHorizontal ? 'vertical' : 'horizontal'; cachedDockWrapper.classList.replace(oppOrientation, orientation); cachedDock.classList.replace(oppOrientation, orientation); } }

    const observeBaddonzWindowChanges = () => {
        const opacityClassObserver = new MutationObserver((mutations) => {
            if (!managerState.unifiedOpacityEnabled) return;
            for (const mutation of mutations) { if (mutation.attributeName === 'class') { for (let i = 0; i < 5; i++) { if (mutation.target.classList.contains(`opacity-${i}`) && i !== managerState.currentOpacity) { window.setBaddonzGlobalOpacity(i); return; } } } }
        });

        new MutationObserver((mutations) => {
            let refreshDockNeeded = false;
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && node.classList && node.classList.contains('baddonz-window')) {
                            bringWindowToFront(node); attachZIndexListener(node);
                            if (managerState.blurBackgroundEnabled) node.classList.add('blur');
                            if (managerState.unifiedOpacityEnabled) { for (let i = 0; i < 5; i++) node.classList.remove(`opacity-${i}`); node.classList.add(`opacity-${managerState.currentOpacity}`); }

                            const wndId = node.dataset.windowId;
                            if (wndId === "baddonz-manager-window" && managerState.positions[wndId]) {
                                node.style.left = managerState.positions[wndId].left; node.style.top = managerState.positions[wndId].top;
                            }
                            opacityClassObserver.observe(node, { attributes: true, attributeFilter: ['class'] }); refreshDockNeeded = true;
                        }
                    });
                }
            });
            if (refreshDockNeeded) refreshDockIcons();
        }).observe(document.body, { childList: true, subtree: true });

        document.querySelectorAll('.baddonz-window').forEach(wnd => { wnd.classList.toggle('blur', managerState.blurBackgroundEnabled); opacityClassObserver.observe(wnd, { attributes: true, attributeFilter: ['class'] }); attachZIndexListener(wnd); });
    };

    async function buildUI() {
        if (!document.querySelector('.baddonz-styles-global')) injectStyles(CSS_URL);

        const opacityBtn = createElement('div', { className: 'baddonz-opacity-button' }); const collapseBtn = createElement('div', { className: 'baddonz-collapsed' }); const header = createElement('div', { className: 'baddonz-window-header' }, createElement('div', { className: 'baddonz-window-controls left' }, opacityBtn), createElement('div', { className: 'baddonz-window-title' }, "Baddonz"), createElement('div', { className: 'baddonz-window-controls right' }, collapseBtn) );
        const tabAddons = createElement('div', { className: 'baddonz-tab', dataset: { tabId: 'addons' }, style: 'flex:1; min-width:calc(50% - 10px); max-width:150px; text-align:center;' }, "Dodatki"); const tabSettings = createElement('div', { className: 'baddonz-tab', dataset: { tabId: 'settings' }, style: 'flex:1; min-width:calc(50% - 10px); max-width:150px; text-align:center;' }, "Ustawienia"); const tabsContainer = createElement('div', { className: 'baddonz-tabs-container', style: 'display:flex; justify-content:space-around; align-items:center; padding:0 5px;' }, tabAddons, tabSettings); const contentArea = createElement('div', { className: 'baddonz-flex column baddonz-tab-content-area', style: 'flex:1; overflow:auto;' }); windowBodyEl = createElement('div', { className: 'baddonz-window-body' }, tabsContainer, contentArea);
        managerWindow = createElement('div', { className: 'baddonz-window baddonz-manager baddonz-jsx-root baddonz-manager-window', dataset: { windowId: 'baddonz-manager-window' }, style: 'position: absolute; z-index: 11;' }, header, windowBodyEl); document.body.appendChild(managerWindow); collapseButtonEl = collapseBtn;
        $(opacityBtn).tip(TOOLTIP_TEXTS.opacityButton); opacityBtn.onclick = () => managerState.unifiedOpacityEnabled ? window.setBaddonzGlobalOpacity((managerState.currentOpacity + 1) % 5) : changeWindowOpacity();
        const tabs = [ { id: "addons", element: tabAddons, renderer: renderAddonsTab }, { id: "settings", element: tabSettings, renderer: renderSettingsTab } ];
        tabs.forEach(t => { t.element.onclick = () => { tabs.forEach(btn => btn.element.classList.remove('active')); t.element.classList.add('active'); managerState.activeTab = t.id; saveState(); t.renderer(contentArea); }; });
        bringWindowToFront(managerWindow); attachZIndexListener(managerWindow);
        if (managerState.unifiedOpacityEnabled) updateAllWindowsOpacity(); else managerWindow.classList.add(`opacity-${managerState.currentOpacity}`);
        if (managerState.isCollapsed) { windowBodyEl.style.display = 'none'; managerWindow.classList.add('collapsed'); } else { windowBodyEl.style.display = 'flex'; managerWindow.style.width = '380px'; managerWindow.style.height = '450px'; }
        updateCloseButtonBehavior();
        const initialTab = tabs.find(t => t.id === managerState.activeTab) || tabs[0]; managerState.activeTab = initialTab.id; initialTab.element.classList.add('active'); initialTab.renderer(contentArea);

        for (const key in managerState.addonStates) {
            if (managerState.addonStates[key] && ADDONS[key]) await loadAddonScript(key, ADDONS[key].url);
        }

        if (managerState.positions["baddonz-manager-window"]) { managerWindow.style.left = managerState.positions["baddonz-manager-window"].left; managerWindow.style.top = managerState.positions["baddonz-manager-window"].top; } else { managerWindow.style.left = '0px'; managerWindow.style.top = '0px'; }
        clampWindowPosition(managerWindow); managerWindow.style.display = managerState.isManagerVisible ? 'flex' : 'none'; refreshDockIcons();
    }

    const init = () => {
        if (isManagerInitialized) return;

        if (!window.Engine || !window.Engine.hero || !window.Engine.hero.d || typeof window.Engine.hero.d.account === 'undefined' || typeof window.Engine.hero.d.id === 'undefined' || !document.querySelector('.game-layer.ui-droppable')) {
            setTimeout(init, 500);
            return;
        }

        try {
            window.BaddonzAPI.accountId = window.Engine.hero.d.account;
            window.BaddonzAPI.charId = window.Engine.hero.d.id;

            loadState();

            injectStyles(CSS_URL); injectDockFixes(); addFontAwesome();
            document.addEventListener('keydown', handleGlobalKeyDown);

            initGlobalWindowControls();
            initGlobalScroll();

            buildUI();
            isManagerInitialized = true;
            observeBaddonzWindowChanges();
            if (managerState.dockEnabled) createDock();
        } catch (error) { setTimeout(init, 500); }
    };
    init();
})();
