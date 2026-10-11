(() => {
    'use strict';

    const bz = window.BaddonzAPI;
    const G = bz.game;
    const R = G.REL;
    const ui = bz.ui;

    const s = bz.store('AX', {
        enabled: true,
        fastFight: false,
        levelRange: '0-500',
        attackFriends: false,
        attackClan: false,
        attackAlly: false,
        clanOptions: true,
        ignoreClans: '',
        alwaysAttackClans: '',
    }, ['enabled', 'fastFight', 'levelRange']);

    const MAIN = `
        <div class="bz-row">
            <div class="baddonz-checkbox" data-key="enabled"></div>
            <input type="text" class="baddonz-input baddonz-small bz-grow" data-key="levelRange" data-pattern="^\\d+-\\d+$" data-error="Błędna wartość lvl. Format: min-max">
        </div>
        <div class="bz-extra"><button class="baddonz-button baddonz-toggle bz-full" data-key="fastFight">S.WALKA</button></div>
    `;

    const SETTINGS = `
        <button class="baddonz-button" data-act="reset-pos">Resetuj pozycje okienka</button>
        ${ui.row('attackFriends', 'Atakuj Przyjaciół')}
        ${ui.row('attackClan', 'Atakuj Klan')}
        ${ui.row('attackAlly', 'Atakuj Sojusz')}
        <div class="bz-sep"></div>
        ${ui.row('clanOptions', 'Kryteria Klanowe')}
        <div class="bz-col" data-show="clanOptions">
            <span class="baddonz-text">Nigdy nie atakuj klanów:</span>
            <textarea class="baddonz-textarea baddonz-scroll" data-key="ignoreClans" placeholder="Nazwa klanu, ID"></textarea>
            <span class="baddonz-text">Zawsze atakuj klany:</span>
            <textarea class="baddonz-textarea baddonz-scroll" data-key="alwaysAttackClans" placeholder="Nazwa klanu, ID"></textarea>
        </div>
    `;

    let range = [0, 500];
    let ignore = [];
    let always = [];
    let timers = [];
    let unhook = null;
    let cancel = null;
    let off = null;
    let last = 0;
    let sent = false;

    const list = v => v.split(',').map(x => x.trim()).filter(Boolean);

    const parse = v => {
        const m = /^(\d+)-(\d+)$/.exec(v);
        return m && +m[1] <= +m[2] ? [+m[1], +m[2]] : [0, 500];
    };

    const refresh = () => {
        range = parse(s.data.levelRange);
        ignore = list(s.data.ignoreClans);
        always = list(s.data.alwaysAttackClans);
    };

    const emotionOk = o => {
        try {
            const obj = window.Engine.others.getById(o.id);
            if (!obj) return false;
            const emo = typeof obj.getOnSelfEmoList === 'function' ? obj.getOnSelfEmoList() : [];
            const first = emo && emo[0] && emo[0].name;
            return !first || !['battle', 'pvpprotected'].includes(first);
        } catch { return false; }
    };

    const selfProtected = () => {
        try {
            const h = window.Engine.hero;
            const l = typeof h.getOnSelfEmoList === 'function' ? h.getOnSelfEmoList() : [];
            return !!l && l.some(e => e && e.name === 'pvpprotected');
        } catch { return false; }
    };

    const mapOk = () => {
        const m = G.map;
        return !!m && (m.pvp === 2 || ['Mapa testerów', 'Polana ekwipunku'].includes(m.name));
    };

    const isEnemy = o => {
        if (typeof o.relation !== 'number') return false;
        const cid = o.clan && typeof o.clan === 'object' ? o.clan.id : null;
        const cname = o.clan && (typeof o.clan === 'object' ? o.clan.name : o.clan);
        const has = arr => (cid && arr.includes(String(cid))) || (cname && arr.includes(cname));
        if (s.data.clanOptions) {
            if (has(always)) return true;
            if (has(ignore)) return false;
        }
        const r = o.relation;
        if ([R.NONE, R.ENEMY, R.CLAN_ENEMY].includes(r)) return true;
        if (r === R.FRIEND && s.data.attackFriends) return true;
        if ([R.CLAN, 7].includes(r) && s.data.attackClan) return true;
        if (r === R.ALLY && s.data.attackAlly) return true;
        return false;
    };

    const targets = () => {
        if (selfProtected() || !mapOk()) return [];
        const party = new Set(G.party().map(p => p.id));
        return G.players().map(p => p.d).filter(o => !o.inBattle && !party.has(Number(o.id)) && o.lvl >= range[0] && o.lvl <= range[1] && emotionOk(o) && isEnemy(o));
    };

    const tick = () => {
        if (!s.data.enabled || G.inBattle()) return;
        const h = G.hero;
        if (!h) return;
        const hx = h.rx ?? h.x;
        const hy = h.ry ?? h.y;
        let best = null;
        let bestDist = Infinity;
        targets().forEach(o => {
            const d = Math.hypot(hx - (o.rx ?? o.x), hy - (o.ry ?? o.y));
            if (d < bestDist) { best = o; bestDist = d; }
        });
        if (best && bestDist <= 3.85 && Date.now() - last >= 300) {
            G.send('fight&a=attack&id=' + best.id);
            last = Date.now();
        }
    };

    const fast = () => {
        if (!G.inBattle()) { sent = false; return; }
        if (!s.data.fastFight || sent) return;
        G.send('fight&a=f');
        sent = true;
    };

    bz.register('AX', {
        store: s,
        init() {
            refresh();
            off = s.onChange(refresh);
            const w = bz.createWindow('AX', 'autox', MAIN, {
                width: 110,
                collapse: true,
                collapsed: true,
                close: false,
                store: s,
                settings: SETTINGS,
                settingsTitle: 'AutoX Ustawienia',
                settingsWidth: 250,
            });
            w.settingsEl.querySelector('[data-act=reset-pos]').onclick = () => bz.resetPosition(w);
            timers = [setInterval(tick, 100), setInterval(fast, 200)];
            cancel = G.when(() => window.Engine?.communication?.parseJSON, () => {
                unhook = G.hook(window.Engine.communication, 'parseJSON', (orig, d, ...rest) => {
                    const res = orig(d, ...rest);
                    if (d && (d.o || d.h || d.f)) tick();
                    return res;
                });
            });
        },
        stop() {
            timers.forEach(clearInterval);
            timers = [];
            if (cancel) cancel();
            if (unhook) unhook();
            if (off) off();
            cancel = null;
            unhook = null;
            off = null;
        },
    });
})();
