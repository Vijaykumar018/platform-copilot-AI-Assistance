// Landing page navigation
document.addEventListener('DOMContentLoaded', () => {
    const exploreBtn = document.getElementById('exploreBtn');
    
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            exploreBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                exploreBtn.style.transform = 'scale(1)';
            }, 200);
            
            setTimeout(() => {
                window.location.href = 'main.html';
            }, 200);
        });
    }
});