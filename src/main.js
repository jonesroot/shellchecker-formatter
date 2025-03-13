import plugin from '../plugin.json';
import styles from "./styles.scss";

const fs = acode.require("fs");
const settings = acode.require("settings");
const toast = acode.require("toast");
const confirm = acode.require("confirm");
let loaded;
let styl;

class ShellCheckPlugin {
    constructor() {
        this.isDragging = false;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isClick = false;

        const arSettings = settings.value[plugin.id] || {
            addFormatBtn: false,
            autoFormatLoadedFiles: false
        };
        settings.value[plugin.id] = arSettings;
        settings.update();
    }

    async init(baseUrl, $page, cacheFile, cacheFileUrl) {
        try {
            const { commands } = editorManager.editor;
            commands.addCommand({
                name: "format-file",
                description: "Format Current File",
                bindKey: { win: "Ctrl-Shift-F", mac: "Command-Shift-F" },
                exec: this.reformat.bind(this)
            });

            if (settings.value[plugin.id].addFormatBtn) {
                this.addBtn();
                loaded = true;
            }
            if (settings.value[plugin.id].autoFormatLoadedFiles) {
                this.recreload();
            }

            acode.defineSetting({
                key: "shellcheck_menu",
                text: "Enable ShellCheck",
                checkbox: false,
                cb: (key, value) => {
                    if (value) {
                        toast("ShellCheck enabled!", 2000);
                    } else {
                        toast("ShellCheck disabled!", 2000);
                    }
                },
            });

        } catch (error) {
            console.error("Error initializing:", error);
            await this.init(baseUrl, $page, cacheFile, cacheFileUrl);
        }
        this.baseUrl = baseUrl;

        const editor = acode.getActiveEditor();
        if (editor) {
            this.addMenu();
        } else {
            toast("No active editor found!", 2000);
        }
    }

    async addMenu() {
        const editor = acode.getActiveEditor();
        if (!editor) return acode.alert("Error", "No open files!");

        const code = editor.getValue();
        try {
            const response = await fetch("https://www.shellcheck.net/api", {
                method: "POST",
                body: new URLSearchParams({ script: code }),
            });

            const result = await response.json();
            if (!result.comments.length) {
                return toast("No issues found!", 2000);
            }

            acode.alert(
                "ShellCheck Errors",
                result.comments.map((c) => `${c.line}: ${c.message}`).join("\n")
            );
        } catch (err) {
            acode.alert("Error", "Failed to check the script.");
        }
    }

    async addQuickToolButton() {
        const btn = document.createElement("button");
        btn.innerText = "ShellCheck";
        btn.style.position = "absolute";
        btn.style.bottom = "20px";
        btn.style.right = "20px";
        btn.style.zIndex = "1000";
        btn.addEventListener("click", () => this.addMenu());
        document.body.appendChild(btn);
    }
}

if (window.acode) {
    const acodePlugin = new ShellCheckPlugin();
    acode.setPluginInit(plugin.id, async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
        await acodePlugin.init(baseUrl, $page, cacheFile, cacheFileUrl);
    });
}
