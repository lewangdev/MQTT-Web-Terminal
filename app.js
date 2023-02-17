(function (w) {
    const deviceId = "hWHbMmfnDa";
    const devcieKey = "CFE4C09C"
    const term = new Terminal({
        cursorBlink: true,
        macOptionIsMeta: true,
        scrollback: true,
    });
    term.attachCustomKeyEventHandler(customKeyEventHandler);
    // https://github.com/xtermjs/xterm.js/issues/2941
    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon.WebLinksAddon());
    term.loadAddon(new SearchAddon.SearchAddon());

    term.open(document.getElementById("terminal"));
    fit.fit();
    term.resize(15, 50);
    console.log(`size: ${term.cols} columns, ${term.rows} rows`);
    fit.fit();
    term.writeln("Welcome to xterm.js!");
    term.writeln("https://github.com/xtermjs/xterm.js");
    term.writeln('')
    term.writeln("You can copy with ctrl+shift+x");
    term.writeln("You can paste with ctrl+shift+v");
    term.writeln('')
    term.onData((data) => {
        console.log("browser terminal received new data:", data);
        mqttc.publish("/device/" + deviceId + "/terminal/input", JSON.stringify({ input: data }));
    });

    const mqttc = mqtt.connect("ws://192.168.52.164:9083/mqtt", { "username": deviceId, "password": devcieKey });
    mqttc.subscribe("/device/" + deviceId + "/terminal/output")
    const status = document.getElementById("status");

    mqttc.on("message", function (topic, payload) {
        console.log(topic)
        if (topic == "/device/" + deviceId + "/terminal/output") {
            data = JSON.parse(payload);
            console.log("new output received from server:", data.output);
            term.write(data.output);
        }
    });

    mqttc.on("connect", () => {
        fitToscreen();
        status.innerHTML =
            '<span style="background-color: lightgreen;">connected</span>';
    });

    mqttc.on("disconnect", () => {
        status.innerHTML =
            '<span style="background-color: #ff8383;">disconnected</span>';
    });

    function fitToscreen() {
        fit.fit();
        const dims = { cols: term.cols, rows: term.rows };
        console.log("sending new dimensions to server's pty", dims);
        mqttc.publish("/device/" + deviceId + "/terminal/resize", JSON.stringify(dims));
    }

    function debounce(func, wait_ms) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait_ms);
        };
    }

    /**
     * Handle copy and paste events
     */
    function customKeyEventHandler(e) {
        if (e.type !== "keydown") {
            return true;
        }
        if (e.ctrlKey && e.shiftKey) {
            const key = e.key.toLowerCase();
            if (key === "v") {
                // ctrl+shift+v: paste whatever is in the clipboard
                navigator.clipboard.readText().then((toPaste) => {
                    term.writeText(toPaste);
                });
                return false;
            } else if (key === "c" || key === "x") {
                // ctrl+shift+x: copy whatever is highlighted to clipboard

                // 'x' is used as an alternate to 'c' because ctrl+c is taken
                // by the terminal (SIGINT) and ctrl+shift+c is taken by the browser
                // (open devtools).
                // I'm not aware of ctrl+shift+x being used by anything in the terminal
                // or browser
                const toCopy = term.getSelection();
                navigator.clipboard.writeText(toCopy);
                term.focus();
                return false;
            }
        }
        return true;
    }

    const wait_ms = 50;
    w.onresize = debounce(fitToscreen, wait_ms);

})(window)