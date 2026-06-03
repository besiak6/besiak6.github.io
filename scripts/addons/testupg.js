// ==UserScript==
// @name          Ulepszator Baddonz [UPG]
// @version       1.0.0
// @author        Baddonz Extension Engine
// @match         https://*.margonem.pl/
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    // Konfiguracja i stałe globalne
    const ADDON_ID = 'UPG';
    const WND_ID = 'wnd-upg-baddonz';
    const MICC_BASE_URL = 'https://micc.garmory-cdn.cloud/obrazki/itemy/';

    const SETTINGS_KEY_ACCOUNT = "baddonz-settings-upgrader-account";
    const SETTINGS_KEY_CHARACTER = "baddonz-settings-upgrader-character";
    const PROGRESS_STORAGE_KEY = "baddonz-enhancement-progress-char";

    const DEFAULT_ACCOUNT_SETTINGS = {
        wnd_pos: { left: '300px', top: '150px' },
        wnd_opacity: 0, // 0 - pełne, 1 - lekkie, 2 - mocne
        wnd_vsb: true,
        wnd_clp: false,
        hotkeyKey: "j"
    };

    const DEFAULT_CHARACTER_SETTINGS = {
        enabled: true,
        autoSelectIngredients: true,
        minRarity: "common",
        maxRarity: "legendary"
    };

    let accountSettings = {};
    let characterSettings = {};
    let isUpgrading = false;

    // Inicjalizacja ustawień
    function loadSettings() {
        try {
            accountSettings = Object.assign({}, DEFAULT_ACCOUNT_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY_ACCOUNT) || '{}'));
            characterSettings = Object.assign({}, DEFAULT_CHARACTER_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY_CHARACTER) || '{}'));
        } catch (e) {
            accountSettings = Object.assign({}, DEFAULT_ACCOUNT_SETTINGS);
            characterSettings = Object.assign({}, DEFAULT_CHARACTER_SETTINGS);
        }
    }

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY_ACCOUNT, JSON.stringify(accountSettings));
        localStorage.setItem(SETTINGS_KEY_CHARACTER, JSON.stringify(characterSettings));
    }

    // Bezpieczne pobieranie instancji przedmiotu przez API Margonem
    function getItem(id) {
        if (window.Engine && Engine.items && typeof Engine.items.getItemById === 'function') {
            return Engine.items.getItemById(id);
        }
        return null;
    }

    // Tworzenie i renderowanie struktury HTML okna w standardzie Baddonz
    function createUI() {
        if ($(`#${WND_ID}`).length) return;

        const opacityClasses = ['baddonz-opacity-full', 'baddonz-opacity-medium', 'baddonz-opacity-low'];
        const currentOpacityClass = opacityClasses[accountSettings.wnd_opacity] || 'baddonz-opacity-full';

        const html = `
            <div id="${WND_ID}" class="baddonz-window ${currentOpacityClass}" style="position: absolute; left: ${accountSettings.wnd_pos.left}; top: ${accountSettings.wnd_pos.top}; z-index: 250; display: ${accountSettings.wnd_vsb ? 'block' : 'none'};">
                <div class="baddonz-window-header ui-draggable-handle">
                    <span class="baddonz-window-title">Ulepszator [${ADDON_ID}]</span>
                    <div class="baddonz-window-controls">
                        <button class="baddonz-icon baddonz-btn-opacity" title="Zmień przezroczystość">🌓</button>
                        <button class="baddonz-icon baddonz-btn-collapse" title="Zwiń / Rozwiń">📑</button>
                        <button class="baddonz-icon baddonz-btn-close" title="Zamknij">✕</button>
                    </div>
                </div>
                <div class="baddonz-window-body" style="display: ${accountSettings.wnd_clp ? 'none' : 'block'};">
                    <div class="baddonz-panel-section">
                        <div class="baddonz-card-title"><span>Przedmiot Główny</span></div>
                        <div id="upg-target-slot" class="baddonz-item-slot-empty">
                            Wybierz przedmiot w grze lub przeciągnij
                        </div>
                    </div>
                    
                    <div class="baddonz-panel-section">
                        <div class="baddonz-card-title"><span>Dostępne Składniki / Reagenty</span></div>
                        <div id="upg-ingredients-list" class="baddonz-ingredients-container">
                            <p class="baddonz-empty-text">Brak załadowanego przedmiotu...</p>
                        </div>
                    </div>

                    <div class="baddonz-panel-section baddonz-controls-row">
                        <button id="upg-btn-start" class="baddonz-button baddonz-button--active" style="width: 100%;">Rozpocznij ulepszanie</button>
                    </div>
                    
                    <div class="baddonz-footer-status">
                        Status: <span id="upg-status-text" style="color: #9da1a7;">Oczekiwanie</span>
                    </div>
                </div>
            </div>
        `;

        $('body').append(html);
        bindEvents();
        updateUI();
    }

    // Wiązanie eventów interfejsu (Drag, przyciski akcji, przezroczystość)
    function bindEvents() {
        const $wnd = $(`#${WND_ID}`);

        // Wsparcie dla jQuery UI Draggable (używanego domyślnie w silniku gry)
        if (typeof $.fn.draggable === 'function') {
            $wnd.draggable({
                handle: '.baddonz-window-header',
                stop: function (event, ui) {
                    accountSettings.wnd_pos = { left: ui.position.left + 'px', top: ui.position.top + 'px' };
                    saveSettings();
                }
            });
        }

        // Przełącznik przezroczystości okna
        $wnd.find('.baddonz-btn-opacity').on('click', function () {
            $wnd.removeClass('baddonz-opacity-full baddonz-opacity-medium baddonz-opacity-low');
            accountSettings.wnd_opacity = (accountSettings.wnd_opacity + 1) % 3;
            const classes = ['baddonz-opacity-full', 'baddonz-opacity-medium', 'baddonz-opacity-low'];
            $wnd.addClass(classes[accountSettings.wnd_opacity]);
            saveSettings();
        });

        // Zwinięcie / Rozwinięcie okna
        $wnd.find('.baddonz-btn-collapse').on('click', function () {
            const $body = $wnd.find('.baddonz-window-body');
            $body.slideToggle(150);
            accountSettings.wnd_clp = !$body.is(':visible');
            saveSettings();
        });

        // Zamknięcie okna
        $wnd.find('.baddonz-btn-close').on('click', function () {
            $wnd.hide();
            accountSettings.wnd_vsb = false;
            saveSettings();
        });

        // Obsługa przycisku startowego
        $('#upg-btn-start').on('click', function () {
            if (isUpgrading) {
                stopUpgradeProcess();
            } else {
                startUpgradeProcess();
            }
        });
    }

    // Aktualizacja zawartości i renderowanie przedmiotów z obsługą sprite baddonz (.baddonz-type-icon)
    function updateUI() {
        if (!accountSettings.wnd_vsb) return;

        // Pobranie aktualnie wybranego przedmiotu do ulepszania z silnika rzemiosła gry
        let activeItem = null;
        if (window.Engine && Engine.crafting && Engine.crafting.enhancement && Engine.crafting.enhancement.selectedEnhanceItem) {
            activeItem = Engine.crafting.enhancement.selectedEnhanceItem;
        }

        const $targetSlot = $('#upg-target-slot');
        const $ingredientsList = $('#upg-ingredients-list');

        if (!activeItem) {
            $targetSlot.html(`<div class="baddonz-item-slot-empty">Wybierz przedmiot w panelu ulepszania gry</div>`);
            $ingredientsList.html(`<p class="baddonz-empty-text">Brak aktywnego procesu.</p>`);
            return;
        }

        // Pobranie pełnych danych przedmiotu przez ID z API gry
        const itemData = getItem(activeItem.id || activeItem);
        if (!itemData) return;

        // Renderowanie przedmiotu głównego z uwzględnieniem klasy cl-X dla ikony typu
        $targetSlot.html(`
            <div class="baddonz-card" style="display: flex; align-items: center; padding: 6px;">
                <div class="baddonz-type-icon cl-${itemData.cl}" style="background-image: url('${MICC_BASE_URL}${itemData.icon}'); background-size: cover; width: 32px; height: 32px; margin-right: 10px; border-radius: 4px;"></div>
                <div>
                    <p style="margin: 0; font-weight: bold; color: #fff;">${itemData.name}</p>
                    <small style="color: #9da1a7;">Poziom: ${itemData.lvl || 'Brak'} | Typ: ${itemData.cl}</small>
                </div>
            </div>
        `);

        // Wyszukiwanie odpowiednich reagentów (np. przedmioty ulepszające cl = 26 lub inne spełniające warunki)
        let ingredientsHtml = '';
        let foundAny = false;

        if (window.Engine && Engine.items) {
            const allItems = Engine.items.getCollection ? Engine.items.getCollection() : [];
            
            // Szukanie ulepszaczy w torbach gracza (st === 0 to przedmioty w torbie)
            for (let id in allItems) {
                const item = allItems[id];
                if (item && item.st === 0 && (item.cl === 26 || item.cl === 21 || item.issetStat?.('upg'))) {
                    foundAny = true;
                    ingredientsHtml += `
                        <div class="baddonz-state-button" data-ingredient-id="${item.id}" style="display: flex; align-items: center; margin-bottom: 4px; padding: 4px; border-radius: 3px; background: rgba(255,255,255,0.03);">
                            <div class="baddonz-type-icon cl-${item.cl}" style="background-image: url('${MICC_BASE_URL}${item.icon}'); background-size: cover; width: 24px; height: 24px; margin-right: 8px;"></div>
                            <span style="font-size: 11px; color: #e1e1e1; flex-grow: 1;">${item.name}</span>
                            <span class="baddonz-text" style="color: #38b8eb; font-size: 11px;">x${item.getStat?.('amount') || 1}</span>
                        </div>
                    `;
                }
            }
        }

        if (!foundAny) {
            $ingredientsList.html(`<p class="baddonz-empty-text">Nie znaleziono pasujących ulepszaczy w torbach.</p>`);
        } else {
            $ingredientsList.html(ingredientsHtml);
        }
    }

    // Odpytywanie asynchroniczne API gry za pomocą oficjalnych akcji sieciowych _g
    function setReagents(itemId, reagentIds) {
        const reagents = Array.isArray(reagentIds) ? reagentIds.join(",") : reagentIds;
        return new Promise((resolve) => {
            if (typeof window._g === 'function') {
                window._g(`enhancement&action=progress_preview&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
            } else {
                resolve(null);
            }
        });
    }

    function enhanceItem(itemId, reagentIds) {
        if (!itemId || !reagentIds) return Promise.resolve(null);
        const reagents = Array.isArray(reagentIds) ? reagentIds.join(",") : reagentIds;
        return new Promise((resolve) => {
            if (typeof window._g === 'function') {
                window._g(`enhancement&action=progress&item=${itemId}&ingredients=${reagents}`, (data) => resolve(data));
            } else {
                resolve(null);
            }
        });
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Automatyczna pętla ulepszania z zachowaniem przerw dla renderowania DOM przez Margonem
    async function startUpgradeProcess() {
        if (isUpgrading) return;
        
        let activeItem = null;
        if (window.Engine && Engine.crafting && Engine.crafting.enhancement && Engine.crafting.enhancement.selectedEnhanceItem) {
            activeItem = Engine.crafting.enhancement.selectedEnhanceItem;
        }

        if (!activeItem) {
            $('#upg-status-text').text('Błąd: brak celu').css('color', '#ff3b30');
            return;
        }

        isUpgrading = true;
        $('#upg-btn-start').text('Zatrzymaj ulepszanie').addClass('baddonz-state-button--active');
        $('#upg-status-text').text('Przetwarzanie...').css('color', '#ffcc00');

        // Zbierz dostępne ID reagentów z widoku okna
        const reagentIds = [];
        $('#upg-ingredients-list [data-ingredient-id]').each(function () {
            reagentIds.push($(this).data('ingredient-id'));
        });

        if (reagentIds.length === 0) {
            $('#upg-status-text').text('Brak składników').css('color', '#ff3b30');
            stopUpgradeProcess();
            return;
        }

        for (let i = 0; i < reagentIds.length; i++) {
            if (!isUpgrading) break;

            const currentReagent = reagentIds[i];
            $('#upg-status-text').text(`Ulepszanie składnikiem ${i + 1}/${reagentIds.length}`);

            // Wyślij żądanie ulepszenia do serwera gry
            const result = await enhanceItem(activeItem.id || activeItem, [currentReagent]);

            // Opóźnienie 300ms, aby silnik gry miał czas na odświeżenie danych i poprawny render stanu
            await sleep(300);
            updateUI();
        }

        $('#upg-status-text').text('Zakończono sekwencję').css('color', '#4cd964');
        stopUpgradeProcess();
    }

    function stopUpgradeProcess() {
        isUpgrading = false;
        $('#upg-btn-start').text('Rozpocznij ulepszanie').removeClass('baddonz-state-button--active');
    }

    // Obsługa skrótu klawiszowego do błyskawicznego wywoływania/ukrywania okna
    function handleHotkeys() {
        $(document).on('keyup', function (e) {
            if (e.key && e.key.toLowerCase() === accountSettings.hotkeyKey.toLowerCase()) {
                // Blokuj wywołanie, jeśli użytkownik pisze na czacie gry
                if ($('input:focus, textarea:focus').length) return;

                const $wnd = $(`#${WND_ID}`);
                if ($wnd.is(':visible')) {
                    $wnd.hide();
                    accountSettings.wnd_vsb = false;
                } else {
                    $wnd.show();
                    accountSettings.wnd_vsb = true;
                    updateUI();
                }
                saveSettings();
            }
        });
    }

    // Oczekiwanie na pełną gotowość API gry (Engine.ready) przed startem
    function initAddon() {
        loadSettings();
        createUI();
        handleHotkeys();

        // Podpięcie automatycznego odświeżania pod natywne eventy zmiany przedmiotów silnika Margonem
        if (window.Engine && Engine.items && typeof Engine.items.fetch === 'function') {
            // Reaguj na zmiany stanu ekwipunku, aby okno zawsze pokazywało aktualne dane ilościowe
            setInterval(() => {
                if ($(`#${WND_ID}`).is(':visible') && !isUpgrading) {
                    updateUI();
                }
            }, 1000);
        }
    }

    if (window.Engine && Engine.ready) {
        initAddon();
    } else {
        $(document).on('engineLoaded', initAddon);
        // Fallback w razie opóźnień
        const checkReady = setInterval(() => {
            if (window.Engine && Engine.ready) {
                clearInterval(checkReady);
                initAddon();
            }
        }, 200);
    }
})();

http://googleusercontent.com/immersive_entry_chip/0
