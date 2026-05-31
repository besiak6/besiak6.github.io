// ==UserScript==
// @name          Item Info baddonz - Legend Edition
// @version       1.0.REWRITE
// @description   Zaawansowane info o itemach + Oznaczenia Bonusów Legendarnych
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "II";

    // --- KONFIGURACJA SKRÓTÓW ---
    const LEGBON_MAP = {
        "curse": "KL",
        "lastheal": "OR",
        "facade": "FO",
        "verycrit": "CBK",
        "holytouch": "DA",
        "glare": "OŚ",
        "critred": "KO",
        "cleanse": "PO",
        "anguish": "KU",
        "puncture": "PS"
    };

    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        /* Styl okna UI */
        .baddonz-ii-wnd { width: 210px; min-width: 210px; }
        .baddonz-ii-wnd .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; }
        .baddonz-ii-wnd .baddonz-text { font-size: 11px; }
        .baddonz-ii-wnd hr { margin: 3px 0 !important; border: 0; border-top: 1px solid #444; }
        
        /* Ukrywanie sekcji dymka na podstawie klas body */
        body:not(.baddonz-ii-essence) .baddonz-essence-marker { display: none !important; }
        body:not(.baddonz-ii-levels) .baddonz-levels-marker { display: none !important; }
        body:not(.baddonz-ii-summary) .baddonz-summary-marker { display: none !important; }
        
        body:not(.baddonz-ii-common) .baddonz-info-rarity-common { display: none !important; }
        body:not(.baddonz-ii-upgraded) .baddonz-info-rarity-upgraded { display: none !important; }
        body:not(.baddonz-ii-unique) .baddonz-info-rarity-unique { display: none !important; }
        body:not(.baddonz-ii-heroic) .baddonz-info-rarity-heroic { display: none !important; }
        body:not(.baddonz-ii-legendary) .baddonz-info-rarity-legendary { display: none !important; }

        body.baddonz-ii-hide-opis.baddonz-ii-common .baddonz-desc-rarity-common { display: none !important; }
        body.baddonz-ii-hide-opis.baddonz-ii-upgraded .baddonz-desc-rarity-upgraded { display: none !important; }
        body.baddonz-ii-hide-opis.baddonz-ii-unique .baddonz-desc-rarity-unique { display: none !important; }
        body.baddonz-ii-hide-opis.baddonz-ii-heroic .baddonz-desc-rarity-heroic { display: none !important; }
        body.baddonz-ii-hide-opis.baddonz-ii-legendary .baddonz-desc-rarity-legendary { display: none !important; }

        /* Styl Nakładki Legbonu (na itemku) */
        .baddonz-leg-overlay {
            position: absolute;
            top: 0; left: 0; width: 32px; height: 32px;
            display: flex; align-items: center; justify-content: center;
            pointer-events: none; z-index: 5;
            font-family: "Arial Black", Gadget, sans-serif;
            font-size: 10px; color: #fff; line-height: 1;
            text-shadow: 
                -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000,
                0px 1px 0 #000, 0px -1px 0 #000, -1px 0px 0 #000, 1px 0px 0 #000,
                -2px -2px 2px #000;
        }
    `;
    document.head.appendChild(styleSheet);

    let currentSettings = {
        enabled: true,
        amount_essence: true,
        SHOW_LEGBON_MARKERS: true,
        HIDE_OPIS: false,
        UPGRADE_LEVEL: true,
        SHOW_SUMMARY_LEGEND: true,
        SHOW_COMMON: true,
        SHOW_UPGRADED: true,
        SHOW_UNIQUE: true,
        SHOW_HEROIC: true,
        SHOW_LEGENDARY: true
    };

    // --- LOGIKA WYDOBYWANIA STATYSTYK ---
    function getStat(statStr, key) {
        if (!statStr) return null;
        const match = statStr.match(new RegExp("(?:^|;)" + key + "=([^;]*)"));
        return match ? match[1] : null;
    }

    // --- GŁÓWNA FUNKCJA OZNACZANIA ITEMÓW (Fetch Engine) ---
    function updateItemMarkers() {
        // Usuwamy stare nakładki przed odświeżeniem
        document.querySelectorAll('.baddonz-leg-overlay').forEach(el => el.remove());

        if (!currentSettings.enabled || !currentSettings.SHOW_LEGBON_MARKERS || !window.Engine || !window.Engine.items) return;

        // Pobieramy wszystkie itemy gracza (ekwipunek, torby, ubrane)
        const allItems = window.Engine.items.fetchLocationItems("g");
        
        allItems.forEach(item => {
            const rarity = getStat(item.stat, "rarity");
            const legbon = getStat(item.stat, "legbon");

            // Warunek: rzadkość legendary ORAZ obecność znanego legbonu
            if (rarity === "legendary" && legbon && LEGBON_SHORT_NAME(legbon)) {
                const shortText = LEGBON_SHORT_NAME(legbon);
                
                // Znajdujemy kontener itemu w DOM (NI używa .item-id-XXXX)
                const $itemNodes = document.querySelectorAll(`.item-id-${item.id}`);
                $itemNodes.forEach(node => {
                    if (!node.querySelector('.baddonz-leg-overlay')) {
                        const overlay = document.createElement('div');
                        overlay.className = 'baddonz-leg-overlay';
                        overlay.innerText = shortText;
                        node.appendChild(overlay);
                    }
                });
            }
        });
    }

    function LEGBON_SHORT_NAME(code) {
        return LEGBON_MAP[code] || null;
    }

    // --- INTEGRACJA Z DYMKAMI (Tooltips) ---
    function injectTooltipInfo(tipHtml, item) {
        if (!tipHtml || tipHtml.includes('baddonz-injected')) return tipHtml;

        const stat = item.stat || "";
        const rarity = getStat(stat, "rarity");
        const lvl = parseInt(getStat(stat, "lvl") || 0) + parseInt(getStat(stat, "lowreq") || 0);

        let $tip = $('<div>').html(tipHtml);
        $tip.append('<div style="display:none;" class="baddonz-injected"></div>');

        // Obsługa esencji przy nazwie
        const salvage = item.salvageItems || Math.round(lvl / 10 + 10);
        let $name = $tip.find('.item-name, .name').first();
        if ($name.length) {
            $name.append(` <span class="c_green baddonz-essence-marker">[${salvage}]</span>`);
        }

        // Jeśli to item ulepszalny, dodajemy sekcje ulepszeń (uproszczone dla czytelności)
        if (rarity && ["legendary", "heroic", "unique", "upgraded", "common"].includes(rarity)) {
            const rarityClass = `baddonz-info-rarity-${rarity}`;
            const descClass = `baddonz-desc-rarity-${rarity}`;
            
            $tip.find('.item-tip-section.s-7').addClass(descClass);
            
            // Sekcja poziomów i podsumowania (placeholder - tu wstawiamy obliczenia z poprzedniego kodu)
            const upgradeInfo = `<div class="item-tip-section baddonz-levels-marker ${rarityClass}"><div style="text-align:center; font-size:10px; color:#aaa;">(Statystyki ulepszeń aktywne)</div></div>`;
            $tip.find('.item-tip-section.s-8, .item-tip-section.s-7').last().after(upgradeInfo);
        }

        return $tip.html();
    }

    // --- BOOTSTRAP I OBSERWACJA ---
    function initAddon() {
        loadSettings();
        buildUI();
        updateBodyClasses();

        // Hook w dymki
        if (window.$ && $.fn.tip) {
            const oldTip = $.fn.tip;
            $.fn.tip = function(content, t, i, p) {
                if (typeof content === 'string' && this.data('item')) {
                    content = injectTooltipInfo(content, this.data('item'));
                }
                return oldTip.call(this, content, t, i, p);
            };
        }

        // Obserwator zmian w itemach (żeby znaczniki pojawiały się po przesunięciu/kupnie)
        const observer = new MutationObserver(() => {
            updateItemMarkers();
        });

        const inv = document.querySelector('.inventory-page, .bag-items');
        if (inv) observer.observe(inv, { childList: true, subtree: true });
        
        // Engine Hook do komunikacji (jak w Znaczniku Teleportów)
        if (window.Engine && window.Engine.communication) {
            const oldJSON = window.Engine.communication.parseJSON;
            window.Engine.communication.parseJSON = function(data) {
                const res = oldJSON.apply(this, arguments);
                if (data.item) setTimeout(updateItemMarkers, 50);
                return res;
            };
        }

        setInterval(updateItemMarkers, 1000); // Fail-safe
    }

    // --- UI I USTAWIENIA ---
    function loadSettings() {
        const data = JSON.parse(localStorage.getItem('BaddonzData') || "{}");
        const accId = window.BaddonzAPI?.accountId;
        if (accId && data[accId]?.accountAddons?.[ADDON_ID]) {
            currentSettings = { ...currentSettings, ...data[accId].accountAddons[ADDON_ID] };
        }
    }

    function saveSettings() {
        const accId = window.BaddonzAPI?.accountId;
        if (!accId) return;
        let data = JSON.parse(localStorage.getItem('BaddonzData') || "{}");
        if (!data[accId]) data[accId] = { accountAddons: {} };
        data[accId].accountAddons[ADDON_ID] = currentSettings;
        localStorage.setItem('BaddonzData', JSON.stringify(data));
        updateBodyClasses();
        updateItemMarkers();
    }

    function updateBodyClasses() {
        const b = document.body;
        const s = currentSettings;
        b.classList.toggle('baddonz-ii-essence', s.amount_essence);
        b.classList.toggle('baddonz-ii-hide-opis', s.HIDE_OPIS);
        b.classList.toggle('baddonz-ii-levels', s.UPGRADE_LEVEL);
        b.classList.toggle('baddonz-ii-summary', s.SHOW_SUMMARY_LEGEND);
        b.classList.toggle('baddonz-ii-common', s.SHOW_COMMON);
        b.classList.toggle('baddonz-ii-upgraded', s.SHOW_UPGRADED);
        b.classList.toggle('baddonz-ii-unique', s.SHOW_UNIQUE);
        b.classList.toggle('baddonz-ii-heroic', s.SHOW_HEROIC);
        b.classList.toggle('baddonz-ii-legendary', s.SHOW_LEGENDARY);
    }

    function buildUI() {
        const html = `
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-essence ${currentSettings.amount_essence ? 'active' : ''}"></div><span class="baddonz-text">Ilość Esencji</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-legbon ${currentSettings.SHOW_LEGBON_MARKERS ? 'active' : ''}"></div><span class="baddonz-text">Skróty bonusów leg.</span></div>
            <hr>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-hide-opis ${currentSettings.HIDE_OPIS ? 'active' : ''}"></div><span class="baddonz-text">Ukrywaj opis</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-levels ${currentSettings.UPGRADE_LEVEL ? 'active' : ''}"></div><span class="baddonz-text">Poziomy ulepszenia</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-summary ${currentSettings.SHOW_SUMMARY_LEGEND ? 'active' : ''}"></div><span class="baddonz-text">Podsumowanie ulepszenia</span></div>
            <div class="baddonz-grid-2col">
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-common ${currentSettings.SHOW_COMMON ? 'active' : ''}"></div><span class="baddonz-text" style="color:#b0b0b0">Zwykłe</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-upgraded ${currentSettings.SHOW_UPGRADED ? 'active' : ''}"></div><span class="baddonz-text" style="color:#cb50ff">Ulepszone</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-unique ${currentSettings.SHOW_UNIQUE ? 'active' : ''}"></div><span class="baddonz-text" style="color:#f0d322">Unikaty</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-heroic ${currentSettings.SHOW_HEROIC ? 'active' : ''}"></div><span class="baddonz-text" style="color:#0080ff">Heroiki</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-legendary ${currentSettings.SHOW_LEGENDARY ? 'active' : ''}"></div><span class="baddonz-text" style="color:#ff0000">Legendy</span></div>
            </div>
        `;

        const win = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Item Info", html, { width: '210px', customId: 'baddonz-ii-wnd' });
        
        const bind = (cls, key) => {
            win.querySelector(`.${cls}`).addEventListener('click', e => {
                currentSettings[key] = e.target.classList.toggle('active');
                saveSettings();
            });
        };

        bind('ii-essence', 'amount_essence');
        bind('ii-legbon', 'SHOW_LEGBON_MARKERS');
        bind('ii-hide-opis', 'HIDE_OPIS');
        bind('ii-levels', 'UPGRADE_LEVEL');
        bind('ii-summary', 'SHOW_SUMMARY_LEGEND');
        bind('ii-common', 'SHOW_COMMON');
        bind('ii-upgraded', 'SHOW_UPGRADED');
        bind('ii-unique', 'SHOW_UNIQUE');
        bind('ii-heroic', 'SHOW_HEROIC');
        bind('ii-legendary', 'SHOW_LEGENDARY');
    }

    // Start
    const checkApi = () => {
        if (window.BaddonzAPI) {
            window.BaddonzAPI.registerAddon(ADDON_ID, { init: initAddon, stop: () => location.reload() });
        } else {
            setTimeout(checkApi, 500);
        }
    };
    checkApi();
})();
