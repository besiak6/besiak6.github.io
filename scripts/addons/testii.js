// ==UserScript==
// @name          Item Info baddonz
// @version       05.08.2025
// @description   Informacje o itemach (API 2.0 - CSS Toggling, Ulepszone, Bez Pogrubienia)
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
        
        body.baddonz-ii-hide-opis .item-tip-section.s-7 { display: none !important; }
        body:not(.baddonz-ii-essence) .baddonz-essence-marker { display: none !important; }
        body:not(.baddonz-ii-levels) .baddonz-levels-marker { display: none !important; }
        body:not(.baddonz-ii-summary) .baddonz-summary-marker { display: none !important; }

        body:not(.baddonz-ii-common) .baddonz-rarity-common { display: none !important; }
        body:not(.baddonz-ii-upgraded) .baddonz-rarity-upgraded { display: none !important; }
        body:not(.baddonz-ii-unique) .baddonz-rarity-unique { display: none !important; }
        body:not(.baddonz-ii-heroic) .baddonz-rarity-heroic { display: none !important; }
        body:not(.baddonz-ii-legendary) .baddonz-rarity-legendary { display: none !important; }
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

    let currentSettings = {
        enabled: true,
        windowOpacity: 2,
        windowVisible: true,
        HIDE_OPIS: false,
        amount_essence: true,
        UPGRADE_LEVEL: true,
        SHOW_SUMMARY_LEGEND: true,
        SHOW_COMMON: true,
        SHOW_UPGRADED: true,
        SHOW_UNIQUE: true,
        SHOW_HEROIC: true,
        SHOW_LEGENDARY: true
    };

    let uiWindowElement = null;

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
        const accKeys = ['enabled', 'windowOpacity', 'windowVisible', 'HIDE_OPIS', 'amount_essence', 'UPGRADE_LEVEL', 'SHOW_SUMMARY_LEGEND', 'SHOW_COMMON', 'SHOW_UPGRADED', 'SHOW_UNIQUE', 'SHOW_HEROIC', 'SHOW_LEGENDARY'];
        
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
            if (key && value !== undefined) result[key] = value;
        }
        return result;
    }

    function addLegendInfoToTip($target) {
        if (!currentSettings.enabled) return;

        const item = $target.data('item');
        if (!item) return;

        const stats = item._cachedStats || parseStats(item.stat);
        const tipId = $target.attr('tip-id');
        let tipHtml = window.TIPS?.allTips[tipId];
        
        if (!tipHtml) return;
        if (tipHtml.includes('baddonz-item-info-injected')) return;

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
            if ($nameEl.length) {
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
            let insertionHtml = `<div class="item-tip-section baddonz-levels-marker baddonz-rarity-${itemRarity}"><div class="tip-item-stat-addon" style="text-align: center; font-size: 11px;">${levelsContent}</div></div>`;

            let upgradeIcon = LEGEND_UPGRADE_ICON, essenceIcon = LEGEND_ESSENCE_ICON;
            if (itemRarity === 'heroic') { upgradeIcon = HEROIC_UPGRADE_ICON; essenceIcon = HEROIC_ESSENCE_ICON; }
            else if (itemRarity === 'unique') { upgradeIcon = UNIQUE_UPGRADE_ICON; essenceIcon = UNIQUE_ESSENCE_ICON; }
            else if (itemRarity === 'upgraded') { upgradeIcon = UPGRADED_UPGRADE_ICON; essenceIcon = UPGRADED_ESSENCE_ICON; }
            else if (itemRarity === 'common') { upgradeIcon = COMMON_UPGRADE_ICON; essenceIcon = COMMON_ESSENCE_ICON; }

            const summaryContent = `${upgradeIcon} <span class="c_blue">${formatNumber(costs.totalPoints)}</span>&nbsp;&nbsp;&nbsp;&nbsp;${essenceIcon} <span class="c_green">${totalEssence}</span>&nbsp;&nbsp;&nbsp;&nbsp;${GOLD_ICON} <span class="c_yellow">${formatBigNumber(totalGold, true)}</span>`;
            insertionHtml += `<div class="item-tip-section baddonz-summary-marker baddonz-rarity-${itemRarity}"><div class="tip-item-stat-addon" style="text-align: center;">${summaryContent}</div></div>`;
            
            let $s8 = $tip.find('.item-tip-section.s-8');
            if ($s8.length) {
                $s8.before(insertionHtml);
            } else {
                let $s7 = $tip.find('.item-tip-section.s-7');
                if ($s7.length) {
                    $s7.after(insertionHtml);
                } else {
                    let $s5 = $tip.find('.item-tip-section.s-5');
                    if ($s5.length) $s5.after(insertionHtml);
                    else $tip.append(insertionHtml);
                }
            }
        }

        const newHtml = $tip.html();
        window.TIPS.allTips[tipId] = newHtml;

        const $visibleTip = window.TIPS?.$tip;
        if ($visibleTip && $visibleTip.is(':visible') && $visibleTip.attr('data-tip-id') === tipId) {
            $visibleTip.html(newHtml);
        }
    }

    function handlePointerEnter() {
        if (!currentSettings.enabled) return;
        const $target = $(this);
        
        setTimeout(() => {
            if ($target.is(':hover')) {
                addLegendInfoToTip($target);
            }
        }, 15);
    }

    function buildUI() {
        const bodyHtml = `
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-hide-opis ${currentSettings.HIDE_OPIS ? 'active' : ''}"></div><span class="baddonz-text">Ukrywaj opis</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-essence ${currentSettings.amount_essence ? 'active' : ''}"></div><span class="baddonz-text">Ilość Esencji</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-levels ${currentSettings.UPGRADE_LEVEL ? 'active' : ''}"></div><span class="baddonz-text">Poziomy ulepszenia</span></div>
            <div class="baddonz-setting-row"><div class="baddonz-checkbox ii-summary ${currentSettings.SHOW_SUMMARY_LEGEND ? 'active' : ''}"></div><span class="baddonz-text">Podsumowanie ulepszenia</span></div>
            <hr style="width: 100%; border-color: #303030; margin: 3px 0;">
            <div class="baddonz-grid-2col">
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

        const bindToggle = (className, key) => {
            const cb = uiWindowElement.querySelector(`.${className}`);
            cb.addEventListener('click', () => {
                currentSettings[key] = cb.classList.toggle('active');
                saveSettings();
                updateBodyClasses();
            });
        };

        bindToggle('ii-hide-opis', 'HIDE_OPIS');
        bindToggle('ii-essence', 'amount_essence');
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

        $(document).on('pointerenter', '[tip-id]', handlePointerEnter);
    }

    function addonStop() {
        if (uiWindowElement) {
            uiWindowElement.remove();
            uiWindowElement = null;
        }
        $(document).off('pointerenter', '[tip-id]', handlePointerEnter);
    }

    function onStateToggle(isEnabled) {
        currentSettings.enabled = isEnabled;
        saveSettings();
        updateBodyClasses();
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500); return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, { init: addonInit, stop: addonStop, onStateToggle: onStateToggle });
    };

    checkApi();

})();
