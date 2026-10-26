document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-demo]');
  if (!t) return;
  showToast('Demo preview — this button is not live yet.');
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.matches('[data-demo-input]')) {
    showToast('Demo preview — search is not live yet.');
  }
});
function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
}
