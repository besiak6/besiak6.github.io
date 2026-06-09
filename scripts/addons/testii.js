// ==UserScript==
// @name          Item Info baddonz
// @version       01.06.2026
// @description   Informacje o itemach
// @author        besiak
// @match         https://*.margonem.pl/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';

    const ADDON_ID = "II";

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.className = "ii-custom-styles";
    styleSheet.innerText = `
        .baddonz-ii-wnd { width: 210px; min-width: 210px; }
        .baddonz-ii-wnd .baddonz-window-body { padding: 4px 6px 6px 6px !important; gap: 3px !important; }
        .baddonz-ii-wnd .baddonz-setting-row { margin-bottom: 2px !important; }
        .baddonz-ii-wnd .baddonz-text { font-size: 11px; }
        .baddonz-ii-wnd hr { margin: 3px 0 !important; }
        
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
    `;
    if (!document.querySelector(".ii-custom-styles")) document.head.appendChild(styleSheet);

    const UPGRADEABLE_RARITIES = ["legendary", "heroic", "unique", "upgraded", "common"];
    const UPGRADEABLE_CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 29];
    const ICON_STYLE = 'width: 22px; height: 22px; background-size: 100%; display: inline-block; vertical-align: middle;';

    const LEGEND_UPGRADE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//upg/lege_enh_ball.gif&quot;);"></div>`;
    const LEGEND_ESSENCE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//neu/pyl-sakryfikacji.gif&quot;);"></div>`;
    const HEROIC_UPGRADE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy/upg/hero_enh_ball.gif&quot;);"></div>`;
    const HEROIC_ESSENCE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//neu/ese_hero.gif&quot;);"></div>`;
    const UNIQUE_UPGRADE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//upg/uniq_enh_ball.gif&quot;);"></div>`;
    const UNIQUE_ESSENCE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//neu/ese_unikat.gif&quot;);"></div>`;
    const UPGRADED_UPGRADE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//upg/upgr_enh_ball.gif&quot;);"></div>`;
    const UPGRADED_ESSENCE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//neu/ese_ulep.gif&quot;);"></div>`;
    const COMMON_UPGRADE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//upg/comm_enh_ball.gif&quot;);"></div>`;
    const COMMON_ESSENCE_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://micc.garmory-cdn.cloud/obrazki/itemy//neu/ese_zwycz.gif&quot;);"></div>`;
    const GOLD_ICON = `<div class="item-details__ico" style="${ICON_STYLE} margin-left: 2px; background-image: url(&quot;https://experimental.margonem.pl/img/goldIconNormal.png&quot;);"></div>`;

    const LEGBON_SHORT = {
        "curse": "KL",
        "lastheal": "OR",
        "facade": "FO",
        "verycrit": "CBK",
        "holytouch": "DA",
        "glare": "OŚ",
        "critred": "KO",
        "cleanse": "PO",
        "anguish": "KU",
        "puncture": "PS",
        "retaliation": "AO",
        "frenzy": "ES"
    };

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
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

    let uiWindowElement = null;
    let observer = null;

    function loadSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        let accSettings = {};
        try {
            const data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (data[accId] && data[accId].accountAddons) {
                accSettings = data[accId].accountAddons[ADDON_ID] || {};
            }
        } catch (e) {}

        // charSettings zawiera windowVisible per postać – stąd createAddonWindow poprawnie odczyta stan
        let charSettings = window.BaddonzAPI.getAddonSettings(ADDON_ID) || {};
        currentSettings = { ...currentSettings, ...accSettings, ...charSettings };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;

        // accKeys: ustawienia per konto (wygląd, przełączniki wspólne)
        const accKeys = ['enabled', 'windowOpacity', 'amount_essence', 'SHOW_LEGBON_MARKERS', 'HIDE_OPIS', 'UPGRADE_LEVEL', 'SHOW_SUMMARY_LEGEND', 'SHOW_COMMON', 'SHOW_UPGRADED', 'SHOW_UNIQUE', 'SHOW_HEROIC', 'SHOW_LEGENDARY'];
        // charKeys: widoczność okienka per postać
        const charKeys = ['windowVisible'];

        let accSettings = {};
        let charSettings = {};
        accKeys.forEach(k => accSettings[k] = currentSettings[k]);
        charKeys.forEach(k => charSettings[k] = currentSettings[k]);

        // Zapis per postać (windowVisible) – stąd createAddonWindow poprawnie odczyta stan
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, charSettings);

        try {
            let data = JSON.parse(localStorage.getItem('BaddonzData')) || {};
            if (!data[accId]) data[accId] = {};
            if (!data[accId].accountAddons) data[accId].accountAddons = {};
            data[accId].accountAddons[ADDON_ID] = accSettings;
            localStorage.setItem('BaddonzData', JSON.stringify(data));
        } catch (e) {}
    }

    function updateBodyClasses() {
        const body = document.body;
        if (!currentSettings.enabled) {
            body.classList.remove('baddonz-ii-hide-opis', 'baddonz-ii-essence', 'baddonz-ii-levels', 'baddonz-ii-summary', 'baddonz-ii-common', 'baddonz-ii-upgraded', 'baddonz-ii-unique', 'baddonz-ii-heroic', 'baddonz-ii-legendary');
            return;
        }
        currentSettings.HIDE_OPIS ? body.classList.add('baddonz-ii-hide-opis') : body.classList.remove('baddonz-ii-hide-opis');
        currentSettings.amount_essence ? body.classList.add('baddonz-ii-essence') : body.classList.remove('baddonz-ii-essence');
        currentSettings.UPGRADE_LEVEL ? body.classList.add('baddonz-ii-levels') : body.classList.remove('baddonz-ii-levels');
        currentSettings.SHOW_SUMMARY_LEGEND ? body.classList.add('baddonz-ii-summary') : body.classList.remove('baddonz-ii-summary');

        currentSettings.SHOW_COMMON ? body.classList.add('baddonz-ii-common') : body.classList.remove('baddonz-ii-common');
        currentSettings.SHOW_UPGRADED ? body.classList.add('baddonz-ii-upgraded') : body.classList.remove('baddonz-ii-upgraded');
        currentSettings.SHOW_UNIQUE ? body.classList.add('baddonz-ii-unique') : body.classList.remove('baddonz-ii-unique');
        currentSettings.SHOW_HEROIC ? body.classList.add('baddonz-ii-heroic') : body.classList.remove('baddonz-ii-heroic');
        currentSettings.SHOW_LEGENDARY ? body.classList.add('baddonz-ii-legendary') : body.classList.remove('baddonz-ii-legendary');
    }

    function formatNumber(num) {
        return num.toLocaleString('pl-PL', { maximumFractionDigits: 0 });
    }

    function formatBigNumber(num, isGold = false) {
        if (num < 1000) return num;
        if (num >= 1000000) {
            const scaled = num / 1000000;
            let formatted;
            if (isGold) {
                const rounded = Math.ceil(scaled * 100) / 100;
                formatted = rounded.toFixed(rounded % 1 === 0 ? 0 : (rounded * 10) % 1 === 0 ? 1 : 2);
            } else {
                formatted = scaled.toFixed(scaled % 1 === 0 ? 0 : 1);
            }
            return formatted.replace(/\.0+$/, '') + 'm';
        } else if (num >= 1000) {
            const scaled = num / 1000;
            let formatted;
            if (isGold) {
                const rounded = Math.ceil(scaled * 100) / 100;
                formatted = rounded.toFixed(rounded % 1 === 0 ? 0 : (rounded * 10) % 1 === 0 ? 1 : 2);
            } else {
                formatted = scaled.toFixed(scaled % 1 === 0 ? 0 : 1);
            }
            return formatted.replace(/\.0+$/, '') + 'k';
        }
        return num.toString();
    }

    function calculateCosts(level, artisanBonus, rarity) {
        const multipliers = [1.0, 1.1, 1.3, 1.6, 2.0];
        let basePoints;
        let totalGoldCost;

        switch (rarity) {
            case "common": basePoints = (Math.floor(level / 10) * 10) + 180; totalGoldCost = 10 * Math.pow(level, 2) + 1300 * level; break;
            case "unique": basePoints = 10 * level + 1800; totalGoldCost = 100 * Math.pow(level, 2) + 13000 * level; break;
            case "upgraded": basePoints = 150 * level + 27000; totalGoldCost = 400 * Math.pow(level, 2) + 52000 * level; break;
            case "heroic": basePoints = 100 * level + 18000; totalGoldCost = 300 * Math.pow(level, 2) + 39000 * level; break;
            case "legendary": basePoints = (180 + level) * 1000; totalGoldCost = 600 * Math.pow(level, 2) + 78000 * level; break;
            default: return null;
        }

        const costs = multipliers.map(m => Math.round(basePoints * m));
        const totalUpgradePoints = costs.reduce((a, b) => a + b, 0);

        const baseEssenceValue = Math.round(level / 10 + 10);
        let totalUpgradeEssence = baseEssenceValue * 3;
        const lastDigit = level % 10;

        if (lastDigit >= 2 && lastDigit <= 4) totalUpgradeEssence += 1;
        else if (lastDigit >= 5 && lastDigit <= 8) totalUpgradeEssence -= 1;

        let dismantleEssence = baseEssenceValue;
        if (artisanBonus) {
            const bonusPercentage = parseInt(artisanBonus, 10) / 100;
            if (!isNaN(bonusPercentage)) {
                dismantleEssence = Math.round(baseEssenceValue * bonusPercentage);
            }
        }

        return { costs: costs, totalPoints: totalUpgradePoints, totalEssence: totalUpgradeEssence, totalGold: totalGoldCost, dismantleEssence: dismantleEssence };
    }

    function parseStats(stats) {
        if (!stats || typeof stats !== "string") return {};
        const result = {};
        for (const pair of stats.split(";")) {
            const [key, value] = pair.split("=");
            if (key && value !== undefined) result[key] = value;
        }
        return result;
    }

    // ==========================================
    // GLOBALNY SYSTEM ZNACZNIKÓW BONUSÓW
    // ==========================================
    function _addSpanToElement(el, text, isBless) {
        let tz = el.querySelector(".baddonz-legbon-marker");
        if (tz && tz.innerText === text && tz.dataset.isBless === String(isBless)) return;

        if (!tz) {
            tz = document.createElement("span");
            tz.className = "baddonz-legbon-marker";
            el.appendChild(tz);
        }

        tz.innerText = text;
        tz.dataset.isBless = isBless;
        
        // Dopasowany wymiar tła, brak zbędnego paddingu, Arial Black
        Object.assign(tz.style, {
            position: "absolute",
            left: "0",
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            color: "#ff6200",
            fontSize: "9px",
            padding: "0px 1px",
            width: "fit-content",
            height: "fit-content",
            fontFamily: "'Arial Black', Gadget, sans-serif",
            lineHeight: "1.1",
            userSelect: "none",
            pointerEvents: "none",
            zIndex: "2"
        });

        // Weryfikacja czy to błogosławieństwo (cl: 25) żeby zmienić pozycje L-G
        if (isBless) {
            tz.style.top = "0";
            tz.style.bottom = "auto";
            tz.style.borderBottomRightRadius = "3px"; // Ładne zaokrąglenie p-d
            tz.style.borderTopRightRadius = "0";
        } else {
            tz.style.bottom = "0";
            tz.style.top = "auto";
            tz.style.borderTopRightRadius = "3px"; // Ładne zaokrąglenie p-g
            tz.style.borderBottomRightRadius = "0";
        }
    }

    function removeAllLegbonMarkers() {
        document.querySelectorAll('.baddonz-legbon-marker').forEach(el => el.remove());
    }

    function applyMarkerToElement(el) {
        if (!el || el.nodeType !== 1) return;
        
        let $el = $(el);
        let itemData = $el.data('item'); 
        
        if (!itemData) {
            let idMatch = el.className.match(/item-id-(\d+)/);
            if (idMatch && window.Engine && window.Engine.items) {
                itemData = window.Engine.items.getItemById(idMatch[1]);
            }
        }

        if (!itemData) return;

        // POBIERAMY Z PAMIĘCI GRY ALBO PRZERABIAMY TYLKO LOKALNIE
        // Absolutnie nic nie nadpisujemy do obiektu itemData!
        let stats = itemData._cachedStats || parseStats(itemData.stat || itemData.stats);
        
        if (stats) {
            // Szukamy któregokolwiek bonusu z tych 3 typów
            let legbonStr = stats.legbon || stats.socket_injection_legbon || stats.socket_fleeting_legbon;
            
            if (legbonStr) {
                let legbonName = legbonStr.split(',')[0];
                if (LEGBON_SHORT[legbonName]) {
                    // Sprawdzamy, czy przedmiot to "błogo" (cl = 25)
                    let isBless = (parseInt(itemData.cl, 10) === 25);
                    _addSpanToElement(el, LEGBON_SHORT[legbonName], isBless);
                    return;
                }
            }
        }
        
        let existingMarker = el.querySelector(".baddonz-legbon-marker");
        if (existingMarker) existingMarker.remove();
    }

    function applyLegbonMarkersToAll() {
        if (!currentSettings.enabled || !currentSettings.SHOW_LEGBON_MARKERS) {
            removeAllLegbonMarkers();
            return;
        }
        document.querySelectorAll('.item').forEach(applyMarkerToElement);
    }
    // ==========================================


    // Główny procesor HTML dymku
    function injectCustomInfo(tipHtml, item) {
        if (!tipHtml || typeof tipHtml !== 'string') return tipHtml;
        if (tipHtml.includes('baddonz-item-info-injected')) return tipHtml;

        const stats = item._cachedStats || parseStats(item.stat);
        
        let $tip = $('<div>').html(tipHtml);
        $tip.append('<div style="display:none;" class="baddonz-item-info-injected"></div>');

        let itemLevel = parseInt(stats?.lvl, 10);
        if (stats.lowreq) itemLevel += parseInt(stats.lowreq, 10);
        const itemClass = item.cl;
        const itemRarity = stats?.rarity;

        let costs = null;
        if (!isNaN(itemLevel) && UPGRADEABLE_CLASSES.includes(itemClass) && UPGRADEABLE_RARITIES.includes(itemRarity)) {
            costs = calculateCosts(itemLevel, stats.artisanbon, itemRarity);
        }

        let dismantleEssence = item.salvageItems;
        if (dismantleEssence === undefined && costs) {
            dismantleEssence = costs.dismantleEssence;
        }

        if (dismantleEssence !== undefined && dismantleEssence !== null) {
            const essenceHtml = ` <span class="c_green baddonz-essence-marker">[${dismantleEssence}]</span>`;
            let $nameEl = $tip.find('.item-name, .tip-item-stat-item-name, .name').first();
            if ($nameEl.length && !$nameEl.html().includes('baddonz-essence-marker')) {
                $nameEl.append(essenceHtml);
            }
        }

        if (stats?.loot) {
            const parts = stats.loot.split(',');
            if (parts.length >= 4) {
                const groupSize = parts[2];
                const timestamp = parts[3];
                const date = new Date(Number(timestamp) * 1000);
                const dateString = date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const timeString = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                
                let $looterEl = $tip.find('.tip-item-stat-loot.looter, .looter').first();
                if ($looterEl.length) {
                    let looterText = $looterEl.html();
                    if (!looterText.includes(timeString.substring(0, 5))) {
                        looterText = looterText.replace(new RegExp(dateString.replace(/\./g, '\\.'), 'g'), `${dateString} ${timeString}`);
                        looterText = looterText.replace(/wraz z drużyną/, `wraz z drużyną (<span class="c_orange">${groupSize}</span>)`);
                        $looterEl.html(looterText);
                    }
                }
            }
        }

        if (costs) {
            const totalEssence = costs.totalEssence;
            const totalGold = costs.totalGold;

            let upgradeLines1_4 = [];
            for (let i = 0; i < 4; i++) upgradeLines1_4.push(`+${i+1}: ${formatBigNumber(costs.costs[i])}`);
            const levelsContent = `<div style="text-align: center;"><span class="c_blue">Koszt Poziomów Ulepszenia:</span></div>${upgradeLines1_4.join(' / ')}<br>+5: ${formatBigNumber(costs.costs[4])} | <span class="c_green">${totalEssence} esy</span> | <span class="c_yellow">${formatBigNumber(totalGold, true)} złota</span>`;
            let insertionHtml = `<div class="item-tip-section baddonz-levels-marker baddonz-info-rarity-${itemRarity}"><div class="tip-item-stat-addon" style="text-align: center; font-size: 11px;">${levelsContent}</div></div>`;

            let upgradeIcon = LEGEND_UPGRADE_ICON, essenceIcon = LEGEND_ESSENCE_ICON;
            if (itemRarity === 'heroic') { upgradeIcon = HEROIC_UPGRADE_ICON; essenceIcon = HEROIC_ESSENCE_ICON; }
            else if (itemRarity === 'unique') { upgradeIcon = UNIQUE_UPGRADE_ICON; essenceIcon = UNIQUE_ESSENCE_ICON; }
            else if (itemRarity === 'upgraded') { upgradeIcon = UPGRADED_UPGRADE_ICON; essenceIcon = UPGRADED_ESSENCE_ICON; }
            else if (itemRarity === 'common') { upgradeIcon = COMMON_UPGRADE_ICON; essenceIcon = COMMON_ESSENCE_ICON; }

            const summaryContent = `${upgradeIcon} <span class="c_blue">${formatNumber(costs.totalPoints)}</span>&nbsp;&nbsp;&nbsp;&nbsp;${essenceIcon} <span class="c_green">${totalEssence}</span>&nbsp;&nbsp;&nbsp;&nbsp;${GOLD_ICON} <span class="c_yellow">${formatBigNumber(totalGold, true)}</span>`;
            insertionHtml += `<div class="item-tip-section baddonz-summary-marker baddonz-info-rarity-${itemRarity}"><div class="tip-item-stat-addon" style="text-align: center;">${summaryContent}</div></div>`;
            
            let $s7 = $tip.find('.item-tip-section.s-7');
            if ($s7.length) {
                $s7.addClass(`baddonz-desc-rarity-${itemRarity}`);
            }

            let $s8 = $tip.find('.item-tip-section.s-8');
            if ($s8.length) {
                $s8.before(insertionHtml);
            } else if ($s7.length) {
                $s7.after(insertionHtml);
            } else {
                let $s5 = $tip.find('.item-tip-section.s-5');
                if ($s5.length) $s5.after(insertionHtml);
                else $tip.append(insertionHtml);
            }
        }

        return $tip.html();
    }

    function hookTipFunction() {
        if (typeof $ !== 'undefined' && $.fn && $.fn.tip && !$.fn.tip._baddonzHooked) {
            const originalTip = $.fn.tip;
            $.fn.tip = function(content, t_type, i_type, params) {
                if (typeof content === 'string' && content.length > 0) {
                    const item = this.data('item');
                    if (item) {
                        try {
                            content = injectCustomInfo(content, item);
                        } catch (e) {}
                    }
                }
                return originalTip.call(this, content, t_type, i_type, params);
            };
            $.fn.tip._baddonzHooked = true;
        }
    }

    function applyToExistingTips() {
        if (!window.TIPS || !window.TIPS.allTips) return;
        
        let modifiedAny = false;
        $('[tip-id]').each(function() {
            const $el = $(this);
            const id = $el.attr('tip-id');
            const item = $el.data('item');
            if (item && window.TIPS.allTips[id]) {
                const newHtml = injectCustomInfo(window.TIPS.allTips[id], item);
                if (newHtml !== window.TIPS.allTips[id]) {
                    window.TIPS.allTips[id] = newHtml;
                    modifiedAny = true;
                }
            }
        });

        const $visibleTip = window.TIPS.$tip;
        if (modifiedAny && $visibleTip && $visibleTip.is(':visible')) {
            const visibleId = $visibleTip.attr('data-tip-id');
            if (visibleId && window.TIPS.allTips[visibleId]) {
                $visibleTip.html(window.TIPS.allTips[visibleId]);
            }
        }
    }

    function buildUI() {
        const bodyHtml = `
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-essence ${currentSettings.amount_essence ? 'active' : ''}"></div><span class="baddonz-text">Ilość Esencji</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-legbon-markers ${currentSettings.SHOW_LEGBON_MARKERS ? 'active' : ''}"></div><span class="baddonz-text">Skróty bonusów leg.</span></div>
            <hr style="width: 100%; border-color: #303030; margin: 3px 0;">
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-hide-opis ${currentSettings.HIDE_OPIS ? 'active' : ''}"></div><span class="baddonz-text">Ukrywaj opis</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-levels ${currentSettings.UPGRADE_LEVEL ? 'active' : ''}"></div><span class="baddonz-text">Poziomy ulepszenia</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-summary ${currentSettings.SHOW_SUMMARY_LEGEND ? 'active' : ''}"></div><span class="baddonz-text">Podsumowanie ulepszenia</span></div>
            <div class="baddonz-grid-2col" style="margin-top: 2px;">
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-common ${currentSettings.SHOW_COMMON ? 'active' : ''}"></div><span class="baddonz-text" style="color: #b0b0b0;">Zwykłe</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-upgraded ${currentSettings.SHOW_UPGRADED ? 'active' : ''}"></div><span class="baddonz-text" style="color: #cb50ff;">Ulepszone</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-unique ${currentSettings.SHOW_UNIQUE ? 'active' : ''}"></div><span class="baddonz-text" style="color: #f0d322;">Unikaty</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-heroic ${currentSettings.SHOW_HEROIC ? 'active' : ''}"></div><span class="baddonz-text" style="color: #0080ff;">Heroiki</span></div>
                <div class="baddonz-label-wrapper"><div class="baddonz-checkbox ii-legendary ${currentSettings.SHOW_LEGENDARY ? 'active' : ''}"></div><span class="baddonz-text" style="color: #ff0000;">Legendy</span></div>
            </div>
        `;

        uiWindowElement = window.BaddonzAPI.createAddonWindow(ADDON_ID, "Item Info", bodyHtml, {
            width: '210px',
            customId: 'baddonz-ii-wnd',
            hasSettings: false,
            hasCollapse: false,
            hasClose: true
        });
        uiWindowElement.classList.add('baddonz-ii-wnd');

        const bindToggle = (className, key, callback = null) => {
            const cb = uiWindowElement.querySelector(`.${className}`);
            cb.addEventListener('click', () => {
                currentSettings[key] = cb.classList.toggle('active');
                saveSettings();
                updateBodyClasses();
                if (callback) callback();
            });
        };

        bindToggle('ii-essence', 'amount_essence');
        bindToggle('ii-legbon-markers', 'SHOW_LEGBON_MARKERS', applyLegbonMarkersToAll);
        bindToggle('ii-hide-opis', 'HIDE_OPIS');
        bindToggle('ii-levels', 'UPGRADE_LEVEL');
        bindToggle('ii-summary', 'SHOW_SUMMARY_LEGEND');
        
        bindToggle('ii-common', 'SHOW_COMMON');
        bindToggle('ii-upgraded', 'SHOW_UPGRADED');
        bindToggle('ii-unique', 'SHOW_UNIQUE');
        bindToggle('ii-heroic', 'SHOW_HEROIC');
        bindToggle('ii-legendary', 'SHOW_LEGENDARY');
    }

    function addonInit() {
        loadSettings();
        if (!uiWindowElement) buildUI();
        updateBodyClasses();

        hookTipFunction();
        
        observer = new MutationObserver((mutations) => {
            if (!currentSettings.enabled || !currentSettings.SHOW_LEGBON_MARKERS) return;
            
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { 
                        if (node.classList && node.classList.contains('item')) {
                            applyMarkerToElement(node);
                        }
                        if (node.querySelectorAll) {
                            let items = node.querySelectorAll('.item');
                            if (items.length > 0) {
                                items.forEach(applyMarkerToElement);
                            }
                        }
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            applyLegbonMarkersToAll();
            applyToExistingTips();
        }, 500); 
    }

    function addonStop() {
        removeAllLegbonMarkers();
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (uiWindowElement) {
            uiWindowElement.remove();
            uiWindowElement = null;
        }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
        updateBodyClasses();
        applyLegbonMarkersToAll();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };

    checkApi();

})();
