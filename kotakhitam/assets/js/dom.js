(function (KH) {
    function escapeHTML(value) {
        return String(value).replace(/[&<>'"]/g, tag => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        })[tag]);
    }

    KH.dom = {
        qs(selector, root = document) {
            return root.querySelector(selector);
        },

        qsa(selector, root = document) {
            return Array.from(root.querySelectorAll(selector));
        },

        showScreen(screenId) {
            this.qsa(".screen").forEach(screen => screen.classList.remove("active-screen"));
            const screen = document.getElementById(screenId);
            if (screen) screen.classList.add("active-screen");
        },

        setVisible(element, visible, display = "block") {
            if (!element) return;
            element.style.display = visible ? display : "none";
        },

        escapeHTML
    };
})(window.KH = window.KH || {});
