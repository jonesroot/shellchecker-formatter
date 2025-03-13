import plugin from '../plugin.json';
import styles from "./styles.scss";
import acode from "acode";

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
        } catch (error) {
            console.error("Error initializing:", error);
            await this.init(baseUrl, $page, cacheFile, cacheFileUrl);
        }
        this.baseUrl = baseUrl;
        this.addMenu();
    }

    async reformat() {
        const em = editorManager;
        const file = em.activeFile;
        if (!file.loaded) return;
        if (file.isUnsaved) {
            const cn = await confirm(
                "Warning!",
                "The current file is unsaved. Changes may be lost. Do you want to Reformat?"
            );
            if (!cn) return;
        }
        const content = await fs(file.uri).readFile(file.encoding);
        if (content != file.session.getValue()) {
            file.session.setValue(content);
            file.isUnsaved = false;
            file.markChanged = false;
            toast("Reformat Successfully!", 1000);
        }
    }

    async recreload() {
        if (!settings.value[plugin.id].autorefreshloadedfiles) return;
        try {
            const em = editorManager;

            for (const e of em.files) {
                if (e == em.activeFile) continue;
                if (!e.loaded) continue;
                if (!e.isUnsaved) continue;
                const content = await fs(e.uri).readFile(e.encoding);
                if (content != e.session.getValue()) {
                    e.session.setValue(content);
                    e.markChanged = false;
                    e.isUnsaved = false;
                    toast(e.filename + "Reformatted.", 200);
                }
            }
            st = setTimeout(this.recreload.bind(this), 10);
        } catch {
            if (!settings.value[plugin.id].autorefreshloadedfiles) return;
            await this.recreload();
        }
    }

    async addBtn() {
        styl = document.createElement("style");
        styl.textContent = styles;
        document.head.appendChild(styl);

        const root = document.getElementById("root");
        if (!root) {
            setTimeout(this.addBtn.bind(this), 1000);
            return;
        }

        this.btn = document.createElement("span");
        this.btn.className = "reformatBtn icon format";
        this.btn.id = "format-btn";
        this.btn.innerText = "Reformat";

        this.btn.style.top = localStorage.getItem("btnTop") || "0px";
        this.btn.style.left = localStorage.getItem("btnLeft") || "calc(100vw - 60px)";

        this.btn.addEventListener("touchstart", this.onTouchStart.bind(this));
        this.btn.addEventListener("touchmove", this.touchMove.bind(this));
        this.btn.addEventListener("touchend", this.touchStop.bind(this));

        root.appendChild(this.btn);
    }

    remBtn() {
        if (!loaded) return;
        const root = document.getElementById("root");
        if (!root) {
            setTimeout(this.remBtn.bind(this), 1000);
            return;
        }
        root.removeChild(this.btn);
        document.head.removeChild(styl);
        loaded = false;
    }

    onTouchStart(e) {
        this.isDragging = true;
        this.isClick = true;
        const touch = e.touches[0];
        this.offsetX = touch.clientX - this.btn.getBoundingClientRect().left;
        this.offsetY = touch.clientY - this.btn.getBoundingClientRect().top;
    }

    touchMove(e) {
        this.isClick = false;
        if (!this.isDragging) return;

        const touch = e.touches[0];
        let x = touch.clientX - this.offsetX;
        let y = touch.clientY - this.offsetY;

        y = Math.max(0, Math.min(y, window.innerHeight - this.btn.offsetHeight));

        this.btn.style.left = `${x}px`;
        localStorage.setItem("btnLeft", `${x}px`);
        this.btn.style.top = `${y}px`;
        localStorage.setItem("btnTop", `${y}px`);
    }

    touchStop() {
        if (this.isClick) {
            this.reformat();
        }
        this.isDragging = false;
    }

    get settingsObject() {
        return {
            list: [
                {
                    key: "addFormatBtn",
                    text: "Add Reformat Button",
                    checkbox: !!settings.value[plugin.id].addFormatBtn
                },
                {
                    key: "autoFormatLoadedFiles",
                    text: "Auto Reformat Loaded Files on change (beta)",
                    checkbox: !!settings.value[plugin.id].autoFormatLoadedFiles
                }
            ],
            cb: (k, v) => {
                settings.value[plugin.id][k] = v;
                settings.update();
                if (k === "addFormatBtn") {
                    v ? this.addBtn() : this.remBtn();
                }
                if (k === "autoFormatLoadedFiles" && v) {
                    this.recreload();
                }
            }
        };
    }

    addMenu() {
        this.shellCheckMenu = acode.addMenuItem("ShellCheck", async () => {
            const editor = acode.getActiveEditor();
            if (!editor) return acode.alert("Error", "No open files!");

            const code = editor.getValue();
            const response = await fetch("https://www.shellcheck.net/api", {
                method: "POST",
                body: new URLSearchParams({ script: code })
            });

            const result = await response.json();
            acode.alert("ShellCheck Errors", result.comments.map(c => `${c.line}: ${c.message}`).join("\n"));
        });
    }
}

if (window.acode) {
    const acodePlugin = new ShellCheckPlugin();
    acode.setPluginInit(plugin.id, async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
        await acodePlugin.init(baseUrl, $page, cacheFile, cacheFileUrl);
    });
}
