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
                const text = (icon.closest('.empty-state')?.textContent || '').toLowerCase();
                const iconName = icon.dataset.emptyIcon
                    || (text.includes('pemain') ? 'users'
                        : text.includes('log') ? 'scroll-text'
                            : text.includes('malam') ? 'moon'
                                : 'circle-dot');
                icon.dataset.emptyIcon = iconName;
                icon.innerHTML = `<i data-lucide="${iconName}"></i>`;
            }
        });
        scope.querySelectorAll('.game-over-icon').forEach(icon => {
            if (!icon.textContent.trim() && !icon.querySelector('svg, [data-lucide]')) {
                icon.innerHTML = '<i data-lucide="trophy"></i>';
            }
        });
    }

    function refresh(root, options = {}) {
        sanitizeText(root || document.body);
        decorateButtons(root || document);
        labelEmptyIconBlocks(root || document);
        refreshDynamicIcons();
        if (!options.skipHydrate) hydrateIcons(root || document);
    }

    document.addEventListener('DOMContentLoaded', () => {
        refresh(document);
    });

    window.werewolfRefreshInterface = refresh;
})();
