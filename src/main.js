import plugin from '../plugin.json';
import acode from "acode";

class ShellCheckPlugin {

  async init(baseUrl, $page, cacheFile, cacheFileUrl) {
    this.baseUrl = baseUrl;
    this.addMenu();
  }

  addMenu() {
    this.shellCheckMenu = acode.addMenuItem("ShellCheck", async () => {
      const editor = acode.getActiveEditor();
      if (!editor) return acode.alert("Error", "No open files!");

      const code = editor.getValue();
      const response = await fetch("https://www.shellcheck.net/api", {
        method: "POST",
        body: new URLSearchParams({ script: code }),
      });

      const result = await response.json();
      if (result.comments.length === 0) {
        acode.toast("✅ There are no errors in the Shell code!");
      } else {
        let errors = result.comments.map(c => `${c.line}: ${c.message}`).join("\n");
        acode.alert("ShellCheck Errors", errors);
      }
    });

    this.formatMenu = acode.addMenuItem("Format Shell Script", async () => {
      const editor = acode.getActiveEditor();
      if (!editor) return acode.alert("Error", "No open files!");

      const code = editor.getValue();
      const response = await fetch("http://159.65.130.123:5000/shfmt", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: code,
      });

      const formattedCode = await response.text();
      editor.setValue(formattedCode);
      acode.toast("✅ Code successfully formatted!");
    });
  }

  async destroy() {
    acode.removeMenuItem(this.shellCheckMenu);
    acode.removeMenuItem(this.formatMenu);
  }
}

if (window.acode) {
  const acodePlugin = new ShellCheckPlugin();
  acode.setPluginInit(plugin.id, async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    await acodePlugin.init(baseUrl, $page, cacheFile, cacheFileUrl);
  });
  acode.setPluginUnmount(plugin.id, () => {
    acodePlugin.destroy();
  });
}
