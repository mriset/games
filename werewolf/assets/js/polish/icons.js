(function () {
    const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]\uFE0F?/gu;
    const CLEAN_SPACES_RE = /[ \t]{2,}/g;
    const ICON_CLASS = 'ww-generated-icon';

    const onclickIconMap = [
        ['showAddPlayerModal', 'user-plus'],
        ['addPlayerFromModal', 'user-plus'],
        ['addPlayer()', 'user-plus'],
        ['randomAssignRoles', 'shuffle'],
        ['clearAllPlayers', 'trash-2'],
        ['clearAllRoles', 'rotate-ccw'],
        ['restartGameKeepPlayers', 'rotate-ccw'],
        ['resetGame', 'trash-2'],
        ['createOnlineRoom', 'plus-circle'],
        ['copyRoomCode', 'copy'],
        ['disconnectRoom', 'x-circle'],
        ['savePlayerGroup', 'save'],
        ['loadPlayerGroup', 'refresh-cw'],
        ['deletePlayerGroup', 'trash-2'],
        ['startGame', 'rocket'],
        ['confirmNightAction', 'check-circle-2'],
        ['skipNightAction', 'skip-forward'],
        ['endNightPhase', 'sunrise'],
        ['showOnlineVoteToPlayers', 'send'],
        ['saveOnlineVoteResult', 'save'],
        ['eliminatePlayer', 'skull'],
        ['resetVotes', 'rotate-ccw'],
        ['clearLog', 'trash-2'],
        ['exportLog', 'clipboard-copy'],
        ['processHunterShot', 'crosshair'],
        ['processWolfSacrifice', 'skull'],
        ['cancelWolfSacrifice', 'x'],
        ['cancelHunterShot', 'x'],
        ['joinRoom', 'log-in'],
        ['backToModeGateway', 'arrow-left'],
        ['nextPhase', 'skip-forward'],
        ['togglePause', 'pause']
    ];

    function iconMarkup(name) {
        return `<span class="${ICON_CLASS}" aria-hidden="true"><i data-lucide="${name}"></i></span>`;
    }

    function hydrateIcons(root) {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({
                root: root || document,
                attrs: {
                    'stroke-width': 2,
                    'aria-hidden': 'true'
                }
            });
        }
    }

    function setIconElement(element, iconName) {
        if (!element) return;
        if (element.dataset.wwIcon === iconName && element.querySelector('svg, [data-lucide]')) return;
        element.dataset.wwIcon = iconName;
        element.innerHTML = `<i data-lucide="${iconName}" aria-hidden="true"></i>`;
        hydrateIcons(element);
    }

    function sanitizeText(root) {
        if (!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }
                EMOJI_RE.lastIndex = 0;
                return EMOJI_RE.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });

        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            EMOJI_RE.lastIndex = 0;
            node.nodeValue = node.nodeValue
                .replace(EMOJI_RE, '')
                .replace(CLEAN_SPACES_RE, ' ')
                .trimStart();
        });
    }

    function iconForPhase() {
        const phase = (document.getElementById('phaseText')?.textContent || '').toLowerCase();
        if (phase.includes('malam')) return 'moon';
        if (phase.includes('siang')) return 'sun';
        return 'settings-2';
    }

    function refreshDynamicIcons() {
        setIconElement(document.getElementById('phaseIcon'), iconForPhase());

        const transition = (document.getElementById('transitionText')?.textContent || '').toLowerCase();
        setIconElement(document.getElementById('transitionIcon'), transition.includes('malam') ? 'moon' : 'sun');

        const fab = document.getElementById('fabNextPhase');
        if (fab) {
            const phase = iconForPhase();
            setIconElement(fab, phase === 'moon' ? 'sun' : phase === 'sun' ? 'moon' : 'skip-forward');
        }

        const pauseText = (document.getElementById('sheetPauseText')?.textContent || '').toLowerCase();
        setIconElement(document.getElementById('sheetPauseIcon'), pauseText.includes('lanjut') ? 'play' : 'pause');

        const pauseBtn = document.getElementById('btnPause');
        if (pauseBtn) setIconElement(pauseBtn, pauseText.includes('lanjut') ? 'play' : 'pause');
    }

    function decorateButtons(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('button[onclick].btn, button[onclick].sheet-menu-item').forEach(button => {
            if (button.querySelector('svg, [data-lucide], .' + ICON_CLASS)) return;
            const handler = button.getAttribute('onclick') || '';
            const match = onclickIconMap.find(([needle]) => handler.includes(needle));
            if (!match) return;
            button.insertAdjacentHTML('afterbegin', iconMarkup(match[1]));
        });
    }

    function labelEmptyIconBlocks(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('.empty-state-icon').forEach(icon => {
            if (!icon.textContent.trim() && !icon.querySelector('svg, [data-lucide]')) {
                icon.innerHTML = '<i data-lucide="circle-dot"></i>';
            }
        });
        scope.querySelectorAll('.game-over-icon').forEach(icon => {
            if (!icon.textContent.trim() && !icon.querySelector('svg, [data-lucide]')) {
                icon.innerHTML = '<i data-lucide="trophy"></i>';
            }
        });
    }

    function refresh(root) {
        sanitizeText(root || document.body);
        decorateButtons(root || document);
        labelEmptyIconBlocks(root || document);
        refreshDynamicIcons();
        hydrateIcons(root || document);
    }

    function installObserver() {
        let queued = false;
        const pendingRoots = new Set();

        function queueRoot(root) {
            if (!root || !root.querySelectorAll) return;
            pendingRoots.add(root);
        }

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'characterData') {
                    queueRoot(mutation.target.parentElement);
                    return;
                }

                if (mutation.type !== 'childList') return;
                if (mutation.removedNodes.length) queueRoot(mutation.target);
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        queueRoot(node);
                    } else if (node.parentElement) {
                        queueRoot(node.parentElement);
                    }
                });
            });

            if (!pendingRoots.size) return;
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                const roots = Array.from(pendingRoots);
                pendingRoots.clear();
                roots.forEach(refresh);
            });
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        refresh(document);
        installObserver();
    });

    window.werewolfRefreshRedesign = refresh;
})();
