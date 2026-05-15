(function (KH) {
    const { dom } = KH;

    let toastContainer = null;
    let toastQueue = [];
    let isShowingToast = false;
    let currentToastTimer = null;

    function init() {
        toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }
    }

    function show(message, type = 'info', duration = 3000) {
        toastQueue.push({ message, type, duration });
        processQueue();
    }

    function processQueue() {
        if (isShowingToast || toastQueue.length === 0 || !toastContainer) return;

        isShowingToast = true;
        const { message, type, duration } = toastQueue.shift();

        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;
        
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        else if (type === 'error') icon = 'fa-exclamation-circle';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${dom.escapeHTML(message)}</span>`;
        
        toastContainer.appendChild(toast);
        
        // Trigger reflow
        void toast.offsetWidth;
        toast.classList.add('show');

        // Haptic feedback based on type
        if (navigator.vibrate) {
            if (type === 'error') navigator.vibrate([50, 50, 50]);
            else if (type === 'success') navigator.vibrate(50);
        }

        currentToastTimer = setTimeout(() => {
            hideToast(toast);
        }, duration);

        toast.addEventListener('click', () => {
            clearTimeout(currentToastTimer);
            hideToast(toast);
        });
    }

    function hideToast(toast) {
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            isShowingToast = false;
            processQueue();
        }, 300); // match animation duration
    }

    // Initialize on DOMContentLoaded if possible, otherwise wait for explicit call or first show
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    KH.toast = {
        init,
        show
    };
})(window.KH = window.KH || {});
