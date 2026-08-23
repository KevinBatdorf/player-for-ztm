export default defineBackground(() => {
  // A `default_path` in the manifest puts the panel on every tab, not just this one.
  const scopeToTabs = () => browser.sidePanel.setOptions({ enabled: false }).catch(() => {});

  // Three times: the manifest applies at browser start, when this worker may be asleep.
  void scopeToTabs();
  browser.runtime.onStartup.addListener(scopeToTabs);
  browser.runtime.onInstalled.addListener(scopeToTabs);

  // Off, because the built-in open gives no tab to scope to; the click handler does.
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

  browser.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;

    void browser.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html', enabled: true });
    // Must stay in the gesture's turn: an awaited call first loses the user activation.
    void browser.sidePanel.open({ tabId: tab.id });
  });
});
