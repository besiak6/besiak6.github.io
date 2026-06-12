(function () {
    'use strict';

    const ADDON_ID = "MINI";

    const knowledgeBase = {
        "alpinia": ["itemy/ros/alpinia.gif"],
        "ananas": ["itemy/kon/ananas.gif"],
        "barwinek": ["npc/odn/barwinek.gif"],
        "beza": ["itemy/que/beza.gif"],
        "bicz": ["itemy/bro/bicz01.gif"],
        "brylant": ["itemy/zlo/roz-brylant.gif"],
        "bryłka srebra": ["itemy/neu/brylkasrebra.gif"],
        "butelka": ["itemy/neu/butelka11.gif", "itemy/kon/zie-nal6.gif"],
        "buty": ["itemy/but/buty55.gif"],
        "chleb": ["itemy/kon/chleb1.gif"],
        "chmiel": ["itemy/kon/chmiel.gif"],
        "chusta": ["itemy/que/chusteczka.gif"],
        "cukierek": ["itemy/eve/cuks7.gif", "itemy/kon/kar_drink13.gif"],
        "czapka": ["itemy/hel/helm111.gif", "itemy/hel/shj-helm04.gif", "itemy/hel/helm33.gif", "itemy/hel/tuz240.gif", "itemy/hat/kap24.gif", "itemy/hat/kap33.gif", "itemy/hat/kap3.gif", "itemy/neu/kapelusz.gif"],
        "czajnik": ["itemy/kon/czajniczek1.gif"],
        "doniczka": ["itemy/que/flos-doniczka.gif"],
        "drewniana tarcza": ["itemy/tar/furbol_tar03.gif", "itemy/tar/wladcy_tarcza01.gif"],
        "echinacea": ["npc/odn/echinacea.gif"],
        "fajka": ["itemy/eve/ev-7.gif"],
        "fiołek": ["npc/odn/fiolek.gif"],
        "gałąź": ["itemy/drz/galaz-dendro.gif"],
        "gitara": ["itemy/neu/gitara.gif"],
        "gruszka": ["itemy/kon/gruszka1.gif"],
        "grzebień": ["itemy/neu/balw-grzebien2.gif"],
        "grzyb": ["itemy/ros/tuz122.gif", "npc/odn/grzyb3n.gif"],
        "grzyby": ["npc/odn/grzyb3n.gif"],
        "hełm": ["itemy/hel/helm111.gif", "itemy/hel/shj-helm04.gif", "itemy/hel/helm33.gif", "itemy/hel/tuz240.gif", "itemy/hat/kap24.gif", "itemy/hat/kap33.gif", "itemy/hat/kap3.gif", "itemy/neu/kapelusz.gif"],
        "jabłko": ["itemy/kon/czer-japko.gif"],
        "jajko": ["itemy/kon/jajko04.gif"],
        "kamień": ["itemy/que/kamien.gif"],
        "kapelusz": ["itemy/hel/helm111.gif", "itemy/hel/shj-helm04.gif", "itemy/hel/helm33.gif", "itemy/hel/tuz240.gif", "itemy/hat/kap24.gif", "itemy/hat/kap33.gif", "itemy/hat/kap3.gif", "itemy/neu/kapelusz.gif"],
        "karaluch": ["itemy/eve/karach.gif"],
        "karta": ["itemy/neu/5kier.gif"],
        "kartka": ["itemy/pap/k3.gif"],
        "karwasze": ["itemy/rek/furbol_r3.gif"],
        "karawasze": ["itemy/rek/furbol_r3.gif"],
        "klepsydra": ["itemy/neu/klepsydra.gif"],
        "klucz": ["itemy/neu/dom-scha.gif"],
        "koce": ["itemy/eve/koce.gif"],
        "kociołek": ["itemy/neu/kociolek1.gif"],
        "kolia": ["itemy/nas/naswilka5.gif"],
        "kołek": ["itemy/que/kolek.gif"],
        "kość": ["itemy/eve/psia-kosc.gif"],
        "kości do gry": ["itemy/neu/kostki.gif"],
        "kostki": ["itemy/neu/kostki.gif"],
        "kosz": ["itemy/neu/kosz1.gif"],
        "kusza": ["itemy/luk/furbol_kusza.gif"],
        "lampion": ["itemy/kon/ark-lamp-nie.gif"],
        "lina": ["itemy/neu/lina3.gif"],
        "lisi ogon": ["itemy/sur/foxtail.gif"],
        "liście": ["itemy/eve/lisc-debu.gif"],
        "lusterko": ["itemy/que/mirror-b.gif"],
        "lustro": ["itemy/que/mirror-b.gif"],
        "lutnia": ["itemy/que/lutnia.gif"],
        "łapacz snów": ["itemy/que/lapacz_quest.gif"],
        "łopata": ["itemy/que/lopata.gif"],
        "łuk": ["itemy/luk/kbunny_luk.gif", "itemy/luk/luk02.gif"],
        "macierzanka": ["itemy/ros/macierzanka.gif"],
        "maczuga": ["itemy/bro/barb_club02.gif"],
        "manierka": ["itemy/neu/zlo-manierka.gif"],
        "manierki": ["itemy/neu/manierki01.gif", "itemy/neu/zlo-manierka.gif"],
        "mapa": ["itemy/pap/mapb05.gif"],
        "maska": ["itemy/eve/maska1.gif"],
        "metalowa tarcza": ["itemy/tar/wladcy_tarcza01.gif"],
        "miecz": ["itemy/mie/miecz01.gif"],
        "miód": ["itemy/pot/miodek1.gif"],
        "miotła": ["itemy/neu/atalia-miotla.gif"],
        "miska": ["itemy/kon/mis-pusta.gif"],
        "moneta": ["itemy/zlo/patr_coin01.gif", "itemy/eve/mik-moneta.gif"],
        "muszla": ["itemy/eve/musz02.gif"],
        "naszyjnik": ["itemy/nas/naszyjnik239.gif"],
        "obrączka": ["itemy/pie/m_ring.gif"],
        "ognisko": ["itemy/eve/stos.gif"],
        "okulary": ["itemy/eve/grabokulary.gif"],
        "paczka": ["itemy/kon/sur46.gif"],
        "pajęczyna": ["npc/odn/pajeczn.gif"],
        "pałeczki": ["itemy/neu/paleczki.gif"],
        "papier": ["itemy/pap/k3.gif"],
        "paproć": ["itemy/eve/kupala-paproc2.gif"],
        "pazury": ["itemy/sur/tuz287.gif"],
        "piasek": ["itemy/neu/mag-pyl01.gif"],
        "pierścień": ["itemy/pie/piersc30.gif"],
        "pióro": ["itemy/eve/boc_pioro.gif", "itemy/neu/kh-piorko.gif"],
        "plaster miodu": ["itemy/kon/maj-miod.gif"],
        "podkowa": ["itemy/que/13-podkowa.gif", "itemy/eve/wlk-podkowa.gif"],
        "poduszka": ["itemy/eve/poduszka.gif"],
        "rubin": ["itemy/zlo/tuz115.gif"],
        "rubiny": ["itemy/zlo/tuz115.gif"],
        "rękawice": ["itemy/rek/rekawice72.gif", "itemy/rek/rekawice322.gif", "itemy/rek/rekawice88.gif", "itemy/rek/rekawice75.gif"],
        "róg": ["itemy/neu/neu08.gif"],
        "sandały": ["itemy/but/sandaly1.gif"],
        "sasanka": ["npc/odn/sasanka.gif"],
        "serwetka": ["itemy/eve/serwetka.gif"],
        "sidła": ["itemy/neu/sidla02.gif"],
        "sierp": ["itemy/neu/sickle01.gif"],
        "skrzynka": ["itemy/bag/heromonk10.gif"],
        "skóra krokodyla": ["itemy/sur/skora_korkodyla.gif"],
        "skóra krolodyla": ["itemy/sur/skora_korkodyla.gif"],
        "słoik": ["itemy/kon/roz-sloik1.gif"],
        "stokrotki": ["npc/odn/stokrotki.gif"],
        "strzała": ["itemy/arr/arrow09.gif", "itemy/arr/wilstrz3.gif", "itemy/arr/trutka3.gif"],
        "strzały": ["itemy/arr/arrow09.gif", "itemy/arr/wilstrz3.gif", "itemy/arr/trutka3.gif"],
        "szczotka": ["itemy/que/szczotka.gif"],
        "sztylet": ["itemy/mie/thuz-sztyl1.gif", "itemy/mie/koch-sztylet.gif"],
        "świeca": ["itemy/neu/swieca06.gif"],
        "talerz": ["itemy/kon/jed31.gif"],
        "tarcza": ["itemy/eve/old-tarcza3.gif", "itemy/tar/sek_tar_u.gif"],
        "tasak": ["itemy/drz/tasak.gif"],
        "topór": ["itemy/top/wladcy_topor.gif"],
        "torba": ["itemy/bag/toolsbag.gif", "itemy/bag/torba11.gif"],
        "trójząb": ["itemy/drz/trojzab02.gif"],
        "trufle": ["itemy/ros/grzyb3n.gif"],
        "waza": ["itemy/neu/amfora11.gif"],
        "wiadro": ["itemy/neu/bucket02.gif"],
        "wianek": ["itemy/eve/sob-wianek4.gif"],
        "widły": ["itemy/bro/goral_widelec.gif"],
        "wino": ["itemy/kon/sur43.gif"],
        "worek": ["itemy/bag/torba11.gif"],
        "wrzos": ["itemy/ros/n-wrzos.gif"],
        "węgiel": ["itemy/que/wegiel.gif"],
        "ziemniaki": ["itemy/kon/sur59.gif"],
        "zwój": ["itemy/pap/pap45.gif"]
    };

    let originalAddWindow = null;
    let isHooked = false;

    function addonInit() {
        if (isHooked) return;

        if (typeof window.Engine === 'undefined' || typeof window.Engine.windowManager === 'undefined') {
            setTimeout(addonInit, 500);
            return;
        }

        originalAddWindow = window.Engine.windowManager.add;

        window.Engine.windowManager.add = function(windowData) {
            if (windowData.nameWindow === window.Engine.windowsData.name.HIDDEN_MINI_GAME) {
                const minigame = windowData.objParent;

                const drawHelpers = function() {
                    if (typeof $ !== 'undefined') {
                        $('.helper-circle').remove();
                    } else {
                        const existingHelpers = document.querySelectorAll('.helper-circle');
                        existingHelpers.forEach(el => el.remove());
                    }

                    if (!minigame.initData || !minigame.initData.objects) return;

                    let elementsToFind = [];
                    if (minigame.$itemList && minigame.$itemList.length > 0) {
                        minigame.$itemList.find('.itemName').each(function() {
                            elementsToFind.push($(this).text().trim().toLowerCase());
                        });
                    } else if (minigame.initData.elements) {
                        elementsToFind = minigame.initData.elements.map(el => el.trim().toLowerCase());
                    }

                    const objects = minigame.initData.objects;
                    const $container = minigame.$hintContainer;

                    if (!$container) return;

                    objects.forEach((obj) => {
                        let knownNames = [];

                        for (let word in knowledgeBase) {
                            if (knowledgeBase[word].some(path => obj.src.includes(path) || path.includes(obj.src))) {
                                knownNames.push(word.toLowerCase());
                            }
                        }

                        let targetName = knownNames.find(name => elementsToFind.includes(name));

                        if (targetName) {
                            let color = "#00ff00";

                            let exactWidth = obj.size[2];
                            let exactHeight = obj.size[3];

                            if (typeof $ !== 'undefined') {
                                let $circle = $("<div>").addClass("helper-circle").css({
                                    position: 'absolute',
                                    top: obj.pos[1] + 'px',
                                    left: obj.pos[0] + 'px',
                                    width: exactWidth + 'px',
                                    height: exactHeight + 'px',
                                    border: `3px solid ${color}`,
                                    borderRadius: '8px',
                                    pointerEvents: 'none',
                                    boxShadow: `0 0 8px ${color}, inset 0 0 5px ${color}`,
                                    zIndex: 1000
                                });

                                $circle.append($("<small>").text(targetName).css({
                                    position: 'absolute',
                                    top: '-18px',
                                    width: '100%',
                                    textAlign: 'center',
                                    color: color,
                                    fontWeight: 'bold',
                                    fontSize: '11px',
                                    textShadow: '1px 1px 2px black'
                                }));

                                $container.append($circle);
                            }
                        }
                    });
                };

                const originalUpdateBoard = minigame.updateBoard;
                minigame.updateBoard = function() {
                    originalUpdateBoard.apply(this, arguments);
                    drawHelpers();
                };

                const originalUpdateElements = minigame.updateElements;
                minigame.updateElements = function(tab) {
                    originalUpdateElements.apply(this, arguments);
                    drawHelpers();
                };

                setTimeout(() => {
                    if (minigame.$board) {
                        drawHelpers();
                    }
                }, 300);
            }
            return originalAddWindow.apply(this, arguments);
        };

        isHooked = true;
    }

    function addonStop() {
        if (isHooked && originalAddWindow && window.Engine && window.Engine.windowManager) {
            window.Engine.windowManager.add = originalAddWindow;
        }

        if (typeof $ !== 'undefined') {
            $('.helper-circle').remove();
        } else {
            const existingHelpers = document.querySelectorAll('.helper-circle');
            existingHelpers.forEach(el => el.remove());
        }

        originalAddWindow = null;
        isHooked = false;
    }

    const checkApi = () => {
        if (!window.BaddonzAPI || !window.BaddonzAPI.registerAddon) {
            setTimeout(checkApi, 500);
            return;
        }
        window.BaddonzAPI.registerAddon(ADDON_ID, {
            init: addonInit,
            stop: addonStop
        });
    };

    checkApi();
})();
