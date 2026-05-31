// ==UserScript==
// @name          Item Info baddonz
// @version       05.08.2025
// @description   Informacje o itemach (API 2.0 - Znaczniki Legbonów, Natychmiastowe dymki)
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

    // Lista powiększona o brakujące legbony.
    const LEGBON_SHORT = {
        "curse": "KL",
        "lastheal": "OR",
        "facade": "FA", // FA = Fasada (żeby nie gryzło się z Fizyczną Osłoną)
        "verycrit": "CBK",
        "holytouch": "DA",
        "glare": "OŚ",
        "critred": "KO",
        "cleanse": "PO",
        "anguish": "KU",
        "puncture": "PS",
        "physred": "FO",
        "critset": "KT",
        "resists": "OŻ",
        "energy": "DE"
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
    let isEngineObserved = false;

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

        currentSettings = { ...currentSettings, ...accSettings };
    }

    function saveSettings() {
        if (!window.BaddonzAPI) return;
        const accId = window.BaddonzAPI.accountId;
        const accKeys = ['enabled', 'windowOpacity', 'windowVisible', 'amount_essence', 'SHOW_LEGBON_MARKERS', 'HIDE_OPIS', 'UPGRADE_LEVEL', 'SHOW_SUMMARY_LEGEND', 'SHOW_COMMON', 'SHOW_UPGRADED', 'SHOW_UNIQUE', 'SHOW_HEROIC', 'SHOW_LEGENDARY'];
        
        let accSettings = {};
        accKeys.forEach(k => accSettings[k] = currentSettings[k]);
        window.BaddonzAPI.saveAddonSettings(ADDON_ID, {});

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
            // Usprawnienie: niektóre statystyki nie mają znaku "=", przypisujemy im wartość 'true'.
            if (key) result[key] = value !== undefined ? value : true; 
        }
        return result;
    }

    // ==========================================
    // SYSTEM ZNACZNIKÓW BONUSÓW LEGENDARNYCH
    // ==========================================
    function addLegbonMarker(id, text) {
        // Poprawiony selektor: w Nowym Interfejsie (NI) upewniamy się, że szuka też po atrybucie 'data-id'
        const $it = document.querySelector(`.item-id-${id}, .item[data-id="${id}"]`);
        if (!$it) return;

        let tz = $it.querySelector(".baddonz-legbon-marker");
        if (tz && tz.innerText === text) return;

        if (!tz) {
            tz = document.createElement("span");
            tz.className = "baddonz-legbon-marker";
            $it.appendChild(tz);
        }

        tz.innerText = text;
        Object.assign(tz.style, {
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%", color: "#fff",
            fontSize: "10px",
            textAlign: "center", lineHeight: 1.5,
            textShadow: `-2px -2px 0 black, -1px -2px 0 black, 0px -2px 0 black, 1px -2px 0 black, 2px -2px 0 black, -2px -1px 0 black, 2px -1px 0 black, -2px 0px 0 black, 2px 0px 0 black, -2px 1px 0 black, 2px 1px 0 black, -2px 2px 0 black, -1px 2px 0 black, 0px 2px 0 black, 1px 2px 0 black, 2px 2px 0 black`,
            fontFamily: "'Arial Black', Gadget, sans-serif",
            userSelect: "none", pointerEvents: "none",
            textRendering: "optimizeLegibility",
            zIndex: 2
        });
    }

    function removeLegbonMarker(id) {
        const $it = document.querySelector(`.item-id-${id}, .item[data-id="${id}"]`);
        if (!$it) return;
        const tz = $it.querySelector(".baddonz-legbon-marker");
        if (tz) tz.remove();
    }

    function removeAllLegbonMarkers() {
        document.querySelectorAll('.baddonz-legbon-marker').forEach(el => el.remove());
    }

    function applyLegbonMarkers(items) {
        if (!currentSettings.enabled || !currentSettings.SHOW_LEGBON_MARKERS) {
            removeAllLegbonMarkers();
            return;
        }
        if (!items || typeof items !== "object") return;
        
        for (const id in items) {
            const it = items[id];
            if (!it || typeof it !== "object") continue;
            
            const stats = it._cachedStats || parseStats(it.stat || it.stats);
            
            if (stats.rarity === 'legendary') {
                // W Margonem kluczem jest nazwa bonusu (np. stats['curse']), a nie 'legbon'.
                let foundLegbon = Object.keys(LEGBON_SHORT).find(bon => stats[bon] !== undefined);
                
                if (foundLegbon) {
                    // Timeout dodany na wypadek, gdyby div z przedmiotem się jeszcze nie wyrenderował w momencie przesyłania JSON.
                    setTimeout(() => addLegbonMarker(id, LEGBON_SHORT[foundLegbon]), 50);
                } else {
                    removeLegbonMarker(id);
                }
            } else {
                removeLegbonMarker(id);
            }
        }
    }

    function applyToAllVisibleItems() {
        if (!currentSettings.enabled || !currentSettings.SHOW_LEGBON_MARKERS) {
            removeAllLegbonMarkers();
            return;
        }
        if (window.Engine && window.Engine.items && window.Engine.items.fetchLocationItems) {
            // Dodano również sprawdzanie zawartości wszystkich toreb gracza ("b"). Samo "g" to tylko ubrany ekwipunek.
            let itemsArray = [];
            try {
                const equipment = window.Engine.items.fetchLocationItems("g") || [];
                const bags = window.Engine.items.fetchLocationItems("b") || [];
                itemsArray = equipment.concat(bags);
            } catch(e) {
                // Fallback do całego słownika itemów
                if (window.Engine.items.items) {
                    itemsArray = Object.values(window.Engine.items.items);
                }
            }
            
            const itemsMap = {};
            for (const item of itemsArray) {
                if (item && item.id) itemsMap[item.id] = item;
            }
            applyLegbonMarkers(itemsMap);
        }
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

    // Bezpośredni Hook w silnik gry (Wstrzykiwanie HTML ZANIM dymek się wyrenderuje)
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
        bindToggle('ii-legbon-markers', 'SHOW_LEGBON_MARKERS', applyToAllVisibleItems);
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
        
        if (!isEngineObserved) {
            const originalParseJSON = window.Engine.communication.parseJSON;
            window.Engine.communication.parseJSON = function (data) {
                const res = originalParseJSON.apply(this, arguments);
                if (data.item) {
                    applyLegbonMarkers(data.item);
                }
                return res;
            };
            isEngineObserved = true;
        }

        setTimeout(() => {
            applyToAllVisibleItems();
            applyToExistingTips();
        }, 500); 
    }

    function addonStop() {
        removeAllLegbonMarkers();
        if (uiWindowElement) {
            uiWindowElement.remove();
            uiWindowElement = null;
        }
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
        updateBodyClasses();
        applyToAllVisibleItems();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };

    checkApi();

})();
