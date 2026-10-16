// Runs before first paint so the saved theme is applied without a flash. Default is dark.
(function () {
  var t = 'dark';
  try { t = localStorage.getItem('theme') || 'dark'; } catch (e) {}
  document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark';
})();
