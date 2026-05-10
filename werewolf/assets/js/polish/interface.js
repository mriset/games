(() => {
    const iconRefresh = window.werewolfRefreshInterface;

    function getCurrentPhase() {
        const phaseText = document.getElementById('phaseText');
        const label = (phaseText?.textContent || '').toLowerCase();
        if (label.includes('malam')) return 'night';
        if (label.includes('siang')) return 'day';
        return 'setup';
    }

    function getActiveTab() {
        const activeTab = document.querySelector('.tab-content.active');
        return activeTab?.id?.replace(/^tab-/, '') || document.body.dataset.activeTab || 'dashboard';
    }

    function syncNavigation(activeTab = getActiveTab()) {
        document.body.dataset.activeTab = activeTab;
        document.querySelectorAll('[data-nav]').forEach(nav => {
            nav.classList.toggle('active', nav.dataset.nav === activeTab);
        });

        const mobileNavBtn = document.querySelector(`.bottom-nav-item[data-nav="${activeTab}"]`);
        const moreBtn = document.querySelector('.bottom-nav-item:last-child');
        if (moreBtn && !mobileNavBtn) moreBtn.classList.add('active');
    }

    function refreshInterface(root, options = {}) {
        const phase = getCurrentPhase();
        document.body.dataset.phase = phase;
        syncNavigation();

        const phaseBanner = document.getElementById('phaseBanner');
        if (phaseBanner) {
            phaseBanner.dataset.phase = phase;
        }

        if (typeof iconRefresh === 'function') {
            iconRefresh(root || document, options);
        } else if (typeof hydrateWerewolfIcons === 'function') {
            hydrateWerewolfIcons(document);
        } else if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    window.werewolfRefreshInterface = refreshInterface;

    document.addEventListener('DOMContentLoaded', () => {
        refreshInterface();
        document.addEventListener('click', event => {
            const nav = event.target.closest?.('[data-nav]');
            if (nav?.dataset?.nav) {
                syncNavigation(nav.dataset.nav);
            }
        }, true);
    });
})();
