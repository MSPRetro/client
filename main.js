const { app, session, dialog, shell, globalShortcut, BrowserWindow } = require("electron");
const { parseString } = require("xml2js");
const { Client } = require("discord-rpc");
const  fetch = require("node-fetch");
const { join } = require("path");
const { createHash } = require("crypto");

// let pluginName;

// switch (process.platform) {
//   case "win32":
//     pluginName = "/plugins/pepflashplayer64_23_0_0_162.dll"
//     break;
//     // pluginName = '/plugins/pepflashplayer32_23_0_0_162.dll' for 32 bits
//   case "darwin":
//     pluginName = "/plugins/PepperFlashPlayer.plugin"
//     break;
//   case "linux":
//     pluginName = "/plugins/libpepflashplayer.so"
//     break;
// };

let cookie = false;

app.commandLine.appendSwitch("ppapi-flash-path", join(__dirname, "/plugins/pepflashplayer64_23_0_0_162.dll"));
app.commandLine.appendSwitch("ppapi-flash-version", "17.0.0.169");

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [ "https://api.mspretro.com/Service" ] }, (details, callback) => {
    let action;

    /*
    let cookieC;

    if (cookie && typeof cookie == "string") {
      details.requestHeaders["cookie"] = "SessionId=" + getCookie(cookie, "SessionId");
      cookieC = "SessionId=" + getCookie(cookie, "SessionId");
      cookie = false;
    } else {
      cookieC;
    }
    */

    parseString(details.uploadData[0].bytes.toString(), (err, result) => {
      action = details.requestHeaders.SOAPAction.replace("http://moviestarplanet.com/", "");
      action = action.replace(new RegExp('"', "gi"), "");

      const json = JSON.stringify(result);
      const checksum = createChecksum(json /* + getCookie(cookieC, "SessionId") */, action);

      details.requestHeaders["checksum_c"] = checksum;
      callback({ requestHeaders: details.requestHeaders });
    });
  });

  const response = await fetch("https://api.mspretro.com/getConfig");
  // cookie = response.headers.get("set-cookie");
  // console.log("[Cookie Generated]: " + cookie);

  const config = await response.json();

    if (config.version > 2) {
      dialog.showMessageBox(null, {
        type: "info",
        title: "MSP Retro - Update",
        buttons: [ "Update" ],
        noLink: true,
        defaultId: 0,
        message: "A new version is available. Please download it to continue playing MSP Retro."
      })
      .then(() => {
        shell.openExternal("https://mspretro.com");
        process.exit();
      });
    } else if (config.maintenance.status) {
      dialog.showMessageBox(null, {
        type: "warning",
        title: "MSP Retro - Maintenance",
        buttons: [ ],
        noLink: true,
        defaultId: 0,
        message: config.maintenance.message
      })
      .then(() => {
        process.exit();
      });
    } else {
      const win = new BrowserWindow({
        width: 800,
        height: 600,
        title: "MSP Retro",
        icon: __dirname + "/logo.png",
        show: false,
        webPreferences: {
          plugins: true
        }
      });

      win.removeMenu();
      win.loadURL("https://cdn.mspretro.com/dev.html");

      let isAccepted = false;
      disclamer();

      function disclamer() {
        dialog.showMessageBox(null, {
          type: "info",
          title: "MSP Retro - Disclamer",
          buttons: [ "I refuse - Close", "Join our Discord server", "I agree - Play" ],
          noLink: true,
          defaultId: 0,
          message: config.disclamer
        })
        .then((box) => {
          if (!isAccepted) {
            switch (box.response) {
              case 0:
                process.exit();

                break;
              case 1:
                shell.openExternal(config.discord);
                disclamer();

                break;
              case 2:
                win.show();
                // win.maximize();
                isAccepted = true;

                break;
            }
          }
        });
      };

      globalShortcut.register("Alt+CommandOrControl+C", () => {
        dialog.showMessageBox(null, {
          type: "question",
          title: "MSP Retro - Clear the cache",
          buttons: [ "Clear the cache", "Cancel" ],
          noLink: true,
          defaultId: 0,
          message: "Do you want to clear the cache stored by MSP Retro?"
        })
        .then((box) => {
          if (box.response == 0) win.webContents.session.clearCache()
          .then(() => {
            dialog.showMessageBox(null, {
              type: "info",
              title: "MSP Retro - Success",
              buttons: [ ],
              noLink: true,
              defaultId: 0,
              message: "The MSP Retro cache has been cleared!"
            })
            .then(() => console.log("[Cache] : The cache has been cleared."));
          });
        });
      });

      win.webContents.on("new-window", (event, url) => {
        event.preventDefault();
        win.loadURL(url);
      });

      try {
        win.webContents.debugger.attach("1.3");
      } catch (err) {
        console.log("Debugger attach failed: ", err);
      };
      
      win.webContents.debugger.on("detach", (event, reason) => {
        console.log("Debugger detached due to: ", reason);
      });
            
      win.webContents.debugger.on("message", (event, method, params) => {
        if (method !== "Network.responseReceived") return;
        if (params.response.url !== "https://api.mspretro.com/Service") return;

        win.webContents.debugger.sendCommand("Network.getResponseBody", { requestId: params.requestId }).then(function(response) {
          parseString(response.body, (err, result) => {
            const json = JSON.stringify(result);
            const checksum = createChecksum(json);

            if (checksum !== params.response.headers.checksum_s) process.exit();
          });
        });
      });
        
      win.webContents.debugger.sendCommand("Network.enable");
  };
});

const client = new Client({ transport: "ipc" });

client.on("ready", () => {
  client.request("SET_ACTIVITY", {
    pid: process.pid,
    activity : {
      details : "A retro private server for MovieStarPlanet.",
      assets : {
      large_image : "logo",
      },
      buttons : [{
        label : "🎮 Play" ,
        url : "https://mspretro.com"
      }, {
      label : "📢 Support server",
      url : "https://discord.gg/bwa9aCr"
      }]
    }
  });
});

client.login({ clientId : "901569099157626910" })
.then(() => console.log("[Success] : The RPC is loaded."))
.catch(() => console.log("[Error] : Unable to load RPC on Discord."));

function createChecksum(args, action = null) {
  let sha = createHash("sha1");

  sha.update(args + action + "NYRL4XSpQi!TgFTmKfYmEXxDNM#bQhba4K#PEahD");
  return sha.digest("hex");
};

/*
function getCookie(cookies, name) {
  cookies = cookies.split(";");

  for (let i = 0; i < cookies.length; i++) {
    c = cookies[i].split("=");

    if (c[0] == name) return c[1];
  };

  return "";
}
*/