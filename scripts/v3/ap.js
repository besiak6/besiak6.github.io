(() => {
    'use strict';

    const bz = window.BaddonzAPI;
    const G = bz.game;
    const s = bz.store('AP', { enabled: true, blocked: [] });

    const BODY = `
        <div class="bz-row"><div class="baddonz-checkbox" data-key="enabled" data-tip="Automatyczna akceptacja przywołania"></div><span class="baddonz-text">Auto Przywo</span></div>
        <div class="bz-col" data-show="enabled"><div class="bz-sep"></div><span class="baddonz-text">Nie akceptuj od:</span><div class="bz-nicks"></div></div>
    `;

    let unhook = null;
    let cancel = null;

    const isBlocked = nick => s.data.blocked.some(b => b.toLowerCase() === nick.toLowerCase());

    const onAlert = (orig, msg, ...rest) => {
        if (s.data.enabled && typeof msg === 'string' && msg.includes('przyzywa do siebie swoją drużynę')) {
            const nick = msg.match(/Gracz (.+?) przyzywa/)?.[1]?.trim();
            if (!nick || !isBlocked(nick)) {
                G.send('party&a=acceptsummon&answer=1');
                if (typeof window.closeModal === 'function') window.closeModal();
                return;
            }
        }
        return orig(msg, ...rest);
    };

    bz.register('AP', {
        store: s,
        init() {
            const w = bz.createWindow('AP', 'Auto Przywo', BODY, { width: 195, store: s });
            bz.ui.stringList(w.querySelector('.bz-nicks'), s, 'blocked', { addTip: 'Dodaj nick do czarnej listy' });
            cancel = G.when(() => typeof window.mAlert === 'function', () => { unhook = G.hook(window, 'mAlert', onAlert); });
        },
        stop() {
            if (cancel) cancel();
            if (unhook) unhook();
            cancel = null;
            unhook = null;
        },
    });
})();
