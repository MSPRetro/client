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

app.commandLine.appendSwitch("ppapi-flash-path", join(__dirname, "/plugins/pepflashplayer64_23_0_0_162.dll"));
app.commandLine.appendSwitch("ppapi-flash-version", "17.0.0.169");

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [ "https://api.mspretro.com/Service" ] }, (details, callback) => {
    let action;
  
    action = details.requestHeaders.SOAPAction.replace("http://moviestarplanet.com/", "");
    action = action.replace(new RegExp('"', "gi"), "");  

    const xml = details.uploadData[0].bytes.toString();

    parseString(xml, (err, result) => {
        const json = JSON.stringify(result);
        const checksum = createChecksum(JSON.stringify(json), action);

        console.log(action, checksum);

        details.requestHeaders["checksum"] = checksum;
        callback({ requestHeaders: details.requestHeaders });
    });
  });

  const config = await fetch("https://api.mspretro.com/getConfig")
    .then(res => res.json());

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
      win.loadURL("https://cdn.mspretro.com/");

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
  };
});

const client = new Client({ transport: "ipc" });

client.on("ready", () => {
  client.request("SET_ACTIVITY", {
    pid: process.pid,
    activity : {
      details : "A MSP retro private server, like in 2010.",
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

function createChecksum(args, action) {
  var sha = createHash("sha1");
  var split = joinArray(args);
  var salt = "123456";

  sha.update(split + args + action + salt);
  var hash = sha.digest("hex");
  return hash;
}

function joinArray(array) {
  var endResult = "";
  for (var arg of array) {
    if (Array.isArray(arg)) {
      endResult += joinArray(arg);
      continue;
    }
    if (arg == undefined || arg == null || arg.hasOwnProperty("Ticket")) {
      continue;
    }
    endResult += arg;
  }
  return endResult;
}