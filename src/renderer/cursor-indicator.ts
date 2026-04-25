const indicator = document.getElementById('indicator') as HTMLElement;

function applySize(sizePx: number) {
  const nextSize = Math.max(16, sizePx);
  indicator.style.setProperty('--indicator-size', `${nextSize}px`);
}

window.voicepaste.onCursorIndicatorUpdate((data) => {
  indicator.dataset.state = data.state;
  applySize(data.sizePx);
});

window.voicepaste.notifyCursorIndicatorReady();
