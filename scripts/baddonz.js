(() => {
    const INSTALL_URL = 'https://besiak6.github.io/scripts/baddonz3.user.js';
    const CSS_URL = window.CSS_URL || 'https://besiak6.github.io/styles/baddonz2.css';
    const ID = 'baddonz-migration';

    if (/^(www|commons)\./.test(location.hostname) || document.getElementById(ID)) return;

    const wipe = () => {
        try {
            Object.keys(localStorage).filter(k => /^baddonz/i.test(k)).forEach(k => localStorage.removeItem(k));
        } catch {}
    };

    const el = (tag, cls, text, css) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (css) e.style.cssText = css;
        if (text) e.textContent = text;
        return e;
    };

    const loadStyles = () => new Promise(resolve => {
        if (document.querySelector('.baddonz-styles-global')) return resolve();
        fetch(CSS_URL)
            .then(r => r.text())
            .then(css => {
                const st = el('style', 'baddonz-styles-global');
                st.textContent = css;
                document.head.appendChild(st);
            })
            .catch(() => {})
            .then(resolve);
    });

    const build = () => {
        if (document.getElementById(ID)) return;
        const box = el('div', 'baddonz-window baddonz-jsx-root opacity-2', '', 'position:fixed;top:50%;left:50%;z-index:99999;width:300px;transform:translate(-50%,-50%)');
        box.id = ID;
        const header = el('div', 'baddonz-window-header');
        header.appendChild(el('div', 'baddonz-window-title', 'Baddonz'));
        const body = el('div', 'baddonz-window-body', '', 'gap:10px;align-items:stretch');
        box.append(header, body);

        const showInstall = () => {
            body.replaceChildren();
            const link = el('a', 'baddonz-text', 'Otwórz stronę instalacji ponownie', 'color:#96f096;text-align:center;cursor:pointer');
            link.href = INSTALL_URL;
            link.target = '_blank';
            link.rel = 'noopener';
            const reload = el('div', 'baddonz-button', 'Odśwież grę', 'text-align:center');
            reload.onclick = () => location.reload();
            body.append(
                el('div', 'baddonz-text', 'Potwierdź instalację nowej wersji w Tampermonkey, a następnie odśwież grę.', 'text-align:center'),
                link,
                reload
            );
        };

        const ok = el('div', 'baddonz-button', 'OK', 'text-align:center');
        ok.onclick = () => {
            wipe();
            window.open(INSTALL_URL, '_blank');
            showInstall();
        };
        body.append(
            el('div', 'baddonz-text', 'Dostępna jest nowa wersja Baddonza.', 'text-align:center'),
            el('div', 'baddonz-text', 'Po kliknięciu OK wszystkie ustawienia obecnej wersji zostaną usunięte i otworzy się strona instalacji nowej wersji.', 'text-align:center;color:#ccc;font-size:11px'),
            ok
        );
        document.body.appendChild(box);
    };

    const start = () => loadStyles().then(build);

    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);
})();
