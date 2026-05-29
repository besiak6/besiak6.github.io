// ==UserScript==
// @name          Item Info
// @version       1.6
// @description   Informacje o itemach
// @author        besiak
// @match         *://*/*
// @grant         none
// ==/UserScript==

(function() {
    'use strict';
    const HIDE_OPIS = false;
    const amount_essence = true;
    const UPGRADE_LEVEL = true;
    const SHOW_SUMMARY_LEGEND = true;
    const SHOW_COMMON = true;
    const SHOW_UNIQUE = true;
    const SHOW_HEROIC = true;
    const SHOW_LEGENDARY = true;

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

    const LEVELS_MARKER = 's1-baddonz';
    const SUMMARY_MARKER = 's2-baddonz';
    const ALL_MARKERS = [LEVELS_MARKER, SUMMARY_MARKER];

    function waitForEngine() {
        return new Promise(resolve => {
            if (window.Engine && window.Engine.items && window.Engine.allInit) {
                resolve();
                return;
            }
            const checkExist = setInterval(() => {
                if (window.Engine && window.Engine.items && window.Engine.allInit) {
                    clearInterval(checkExist);
                    resolve();
                }
            }, 100);
        });
    }

    function formatNumber(num) {
        return num.toLocaleString('pl-PL', {
            maximumFractionDigits: 0
        });
    }

    function formatBigNumber(num, isGold = false) {
        if (num < 1000) {
            return num;
        }

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
        }
        else if (num >= 1000) {
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
            case "common":
                basePoints = (Math.floor(level / 10) * 10) + 180;
                totalGoldCost = 10 * Math.pow(level, 2) + 1300 * level;
                break;
            case "unique":
                basePoints = 10 * level + 1800;
                totalGoldCost = 100 * Math.pow(level, 2) + 13000 * level;
                break;
            case "upgraded":
                basePoints = 150 * level + 27000;
                totalGoldCost = 400 * Math.pow(level, 2) + 52000 * level;
                break;
            case "heroic":
                basePoints = 100 * level + 18000;
                totalGoldCost = 300 * Math.pow(level, 2) + 39000 * level;
                break;
            case "legendary":
                basePoints = (180 + level) * 1000;
                totalGoldCost = 600 * Math.pow(level, 2) + 78000 * level;
                break;
            default:
                return null;
        }

        const costs = multipliers.map(m => Math.round(basePoints * m));
        const totalUpgradePoints = costs.reduce((a, b) => a + b, 0);

        const baseEssenceValue = Math.round(level / 10 + 10);
        let totalUpgradeEssence = baseEssenceValue * 3;

        const lastDigit = level % 10;

        if (lastDigit >= 2 && lastDigit <= 4) {
            totalUpgradeEssence += 1;
        } else if (lastDigit >= 5 && lastDigit <= 8) {
            totalUpgradeEssence -= 1;
        }

        let dismantleEssence = baseEssenceValue;
        if (artisanBonus) {
            const bonusPercentage = parseInt(artisanBonus, 10) / 100;
            if (!isNaN(bonusPercentage)) {
                dismantleEssence = Math.round(baseEssenceValue * bonusPercentage);
            }
        }

        return {
            costs: costs,
            totalPoints: totalUpgradePoints,
            totalEssence: totalUpgradeEssence,
            totalGold: totalGoldCost,
            dismantleEssence: dismantleEssence
        };
    }

    function shouldShowInfo(rarity) {
        if (!UPGRADE_LEVEL && !SHOW_SUMMARY_LEGEND) return false;

        switch (rarity) {
            case "common":
                return SHOW_COMMON;
            case "unique":
                return SHOW_UNIQUE;
            case "upgraded":
                return true;
            case "heroic":
                return SHOW_HEROIC;
            case "legendary":
                return SHOW_LEGENDARY;
            default:
                return false;
        }
    }

    function addLegendInfoToTip() {
        const $target = $(this);
        const item = $target.data('item');

        if (!item) return;

        const stats = item._cachedStats;
        let itemLevel = parseInt(stats?.lvl, 10);

        if (stats.lowreq) {
            itemLevel += parseInt(stats.lowreq, 10);
        }

        const itemClass = item.cl;
        const itemRarity = stats?.rarity;
        const tipId = $target.attr('tip-id');
        let currentTipContent = window.TIPS?.allTips[tipId] || "";

        const essenceMarker = "c_essence_marker";
        const $visibleTip = window.TIPS?.$tip;

        if (amount_essence && item.salvageItems) {
            const dismantleEssence = item.salvageItems;
            if (!currentTipContent.includes(essenceMarker)) {
                const itemDisplayName = item.name || 'Brak nazwy';
                const newNameContent = `${itemDisplayName} [<span class="c_green ${essenceMarker}" style="font-weight: bold;">${dismantleEssence}</span>]`;

                $target.changeInTip('.tip-item-stat-item-name', newNameContent);
                currentTipContent = window.TIPS?.allTips[tipId] || "";

                if ($visibleTip) {
                    const $itemName = $visibleTip.find('.tip-item-stat-item-name');
                    if ($itemName.length) {
                        $itemName.html(newNameContent);
                    }
                }
            }
        }

        const lootData = stats?.loot;
        if (lootData && $visibleTip) {
            const parts = lootData.split(',');
            const [, , groupSize, timestamp] = parts;

            const dateMs = Number(timestamp) * 1000;
            const date = new Date(dateMs);
            const dateString = date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeString = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

            const $lootElement = $visibleTip.find('.tip-item-stat-loot.looter');

            if ($lootElement.length) {
                const originalLootText = $lootElement.html();

                if (originalLootText.includes(timeString.substring(0, 5))) {
                    return;
                }

                const findDateRegex = new RegExp(dateString.replace(/\./g, '\\.'), 'g');
                const findTeamRegex = /wraz z drużyną/;

                let newLootText = originalLootText;

                newLootText = newLootText.replace(findDateRegex, `${dateString} ${timeString}`);
                newLootText = newLootText.replace(findTeamRegex, `wraz z drużyną (<span class="c_orange">${groupSize}</span>)`);

                $lootElement.html(newLootText);
                $target.changeInTip('.tip-item-stat-loot.looter', newLootText);
                currentTipContent = window.TIPS?.allTips[tipId] || "";
            }
        }
        if (isNaN(itemLevel) || !UPGRADEABLE_CLASSES.includes(itemClass) || !UPGRADEABLE_RARITIES.includes(itemRarity) || !shouldShowInfo(itemRarity)) {
             return;
        }

        if (HIDE_OPIS && $visibleTip) {
            const $s7 = $visibleTip.find('.item-tip-section.s-7');
            if ($s7.length) {
                $s7.remove();
            }
            currentTipContent = currentTipContent.replace(/<div class="item-tip-section s-7">[\s\S]*?<\/div>/, '');
            window.TIPS.allTips[tipId] = currentTipContent;
        }

        const markerExists = ALL_MARKERS.some(marker => currentTipContent.includes(marker));
        if (markerExists) {
            return;
        }

        const artisanBonus = stats.artisanbon;
        const costs = calculateCosts(itemLevel, artisanBonus, itemRarity);

        if (!costs) return;

        const totalEssence = costs.totalEssence;
        const totalGold = costs.totalGold;

        let levelsSectionHtml = '';
        if (UPGRADE_LEVEL) {
            let upgradeLines1_4 = [];

            for (let i = 0; i < 4; i++) {
                const level = i + 1;
                const cost = costs.costs[i];
                const formattedCost = formatBigNumber(cost);
                upgradeLines1_4.push(`+${level}: ${formattedCost}`);
            }

            const cost5 = costs.costs[4];
            const formattedCost5 = formatBigNumber(cost5);
            const formattedGold = formatBigNumber(totalGold, true);

            const upgradeLine5 = `+5: ${formattedCost5} | <span class="c_green">${totalEssence} esy</span> | <span class="c_yellow">${formattedGold} złota</span>`;

            const levelsContent = `<div style="text-align: center;"><span class="c_blue">Koszt Poziomów Ulepszenia:</span></div>` +
                                     upgradeLines1_4.join(' / ') +
                                     `<br>` +
                                     upgradeLine5;

            levelsSectionHtml = `
                <div class="item-tip-section ${LEVELS_MARKER}">
                    <div class="tip-item-stat-addon" style="text-align: center; font-size: 11px;">${levelsContent}</div>
                </div>
            `;
        }

        let summarySectionHtml = '';
        if (SHOW_SUMMARY_LEGEND) {
            let summaryContent = ``;

            let upgradeIcon;
            let essenceIcon;

            switch (itemRarity) {
                case "legendary":
                    upgradeIcon = LEGEND_UPGRADE_ICON;
                    essenceIcon = LEGEND_ESSENCE_ICON;
                    break;
                case "heroic":
                    upgradeIcon = HEROIC_UPGRADE_ICON;
                    essenceIcon = HEROIC_ESSENCE_ICON;
                    break;
                case "unique":
                    upgradeIcon = UNIQUE_UPGRADE_ICON;
                    essenceIcon = UNIQUE_ESSENCE_ICON;
                    break;
                case "upgraded":
                    upgradeIcon = UPGRADED_UPGRADE_ICON;
                    essenceIcon = UPGRADED_ESSENCE_ICON;
                    break;
                case "common":
                    upgradeIcon = COMMON_UPGRADE_ICON;
                    essenceIcon = COMMON_ESSENCE_ICON;
                    break;
                default:
                    upgradeIcon = LEGEND_UPGRADE_ICON;
                    essenceIcon = LEGEND_ESSENCE_ICON;
            }

            const formattedGoldSummary = formatBigNumber(totalGold, true);

            summaryContent += `${upgradeIcon} <span class="c_blue">${formatNumber(costs.totalPoints)}</span>`;
            summaryContent += `&nbsp;&nbsp;&nbsp;&nbsp;`;
            summaryContent += `${essenceIcon} <span class="c_green">${totalEssence}</span>`;
            summaryContent += `&nbsp;&nbsp;&nbsp;&nbsp;`;
            summaryContent += `${GOLD_ICON} <span class="c_yellow">${formattedGoldSummary}</span>`;

            summarySectionHtml = `
                <div class="item-tip-section ${SUMMARY_MARKER}">
                    <div class="tip-item-stat-addon" style="text-align: center;">${summaryContent}</div>
                </div>
            `;
        }

        const insertionHtml = levelsSectionHtml + summarySectionHtml;
        const insertionMarker = '<div class="item-tip-section s-8">';

        if ($visibleTip) {
            const $s8 = $visibleTip.find('.item-tip-section.s-8');

            if ($s8.length) {
                $s8.before(insertionHtml);
            } else {
                const $s7 = $visibleTip.find('.item-tip-section.s-7');
                if ($s7.length) {
                     $s7.after(insertionHtml);
                } else {
                    const $s5 = $visibleTip.find('.item-tip-section.s-5');
                    if ($s5.length) $s5.after(insertionHtml);
                }
            }

            const index = currentTipContent.indexOf(insertionMarker);

            if (index !== -1) {
                const partBefore = currentTipContent.substring(0, index);
                const partAfter = currentTipContent.substring(index);
                window.TIPS.allTips[tipId] = partBefore + insertionHtml + partAfter;
            } else {
                $target.concatTip(insertionHtml);
            }
        }
    }

    function init() {
        $(document).on('pointerenter', '[tip-id]', addLegendInfoToTip);
    }

    waitForEngine().then(init);

})();
