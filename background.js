// background.js – Manifest V3 service‑worker
// Trufflehog browser extension
// ---------------------------------------------
// Key changes from the old MV2 version:
//   • Uses chrome.scripting.*, chrome.action.*, chrome.tabs.query()
//   • Replaces alert() with chrome.notifications (UI‑safe in service workers)
//   • Removes deprecated APIs (browserAction, tabs.getSelected, tabs.executeScript)
//   • Keeps most of your original logic / regex tables intact
// --------------------------------------------------------------

const VERSION = "1.0";

//--------------------------------------------------
// 0. First‑run initialisation
//--------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated, initializing...");
  chrome.storage.sync.get(["ranOnce"], ({ ranOnce }) => {
    if (!ranOnce) {
      console.log("First run detected, setting initial preferences");
      chrome.storage.sync.set({
        ranOnce: true,
        originDenyList: ["https://www.google.com"],
      });
    } else {
      console.log("Extension already initialized");
    }
  });
});

//--------------------------------------------------
// 1. Utility: inject our content‑script into a tab
//--------------------------------------------------
async function injectContentScript(tabId) {
  console.log(`Attempting to inject content script into tab ${tabId}`);
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["inject.js"],
    });
    console.log(`Successfully injected content script into tab ${tabId}`);
  } catch (e) {
    // Will fail on special pages such as chrome:// – just log
    console.error(`Content script injection failed for tab ${tabId}:`, e);
  }
}

//--------------------------------------------------
// 2. Inject into the current active tab on startup
//--------------------------------------------------
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs.length && tabs[0].id && !tabs[0].url.startsWith("chrome://")) {
    injectContentScript(tabs[0].id);
  }
});

//--------------------------------------------------
// 3. Inject again when the user clicks the toolbar icon
//--------------------------------------------------
chrome.action.onClicked.addListener((tab) => {
  if (tab.id && !tab.url.startsWith("chrome://")) {
    injectContentScript(tab.id);
  }
});

//--------------------------------------------------
// 4. Regex databases (unchanged from your original code)
//--------------------------------------------------
let specifics = {
    "Slack Token": "(xox[pboa]-[0-9]{12}-[0-9]{12}-[0-9]{12}-[a-z0-9]{32})",
    "RSA private key": "-----BEGIN RSA PRIVATE KEY-----",
    "SSH (DSA) private key": "-----BEGIN DSA PRIVATE KEY-----",
    "SSH (EC) private key": "-----BEGIN EC PRIVATE KEY-----",
    "PGP private key block": "-----BEGIN PGP PRIVATE KEY BLOCK-----",
    "Amazon MWS Auth Token": "amzn\\.mws\\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    "AWS AppSync GraphQL Key": "da2-[a-z0-9]{26}",
    "Facebook Access Token": "EAACEdEose0cBA[0-9A-Za-z]+",
    "Facebook OAuth": "[fF][aA][cC][eE][bB][oO][oO][kK].{0,20}['|\"][0-9a-f]{32}['|\"]",
    "GitHub": "[gG][iI][tT][hH][uU][bB].{0,20}['|\"][0-9a-zA-Z]{35,40}['|\"]",
   // "Google API Key": "AIza[0-9A-Za-z\\-_]{35}",
   // "Google Cloud Platform API Key": "AIza[0-9A-Za-z\\-_]{35}",
   // "Google Cloud Platform OAuth": "[0-9]+-[0-9A-Za-z_]{32}\\.apps\\.googleusercontent\\.com",
   // "Google Drive API Key": "AIza[0-9A-Za-z\\-_]{35}",
   // "Google Drive OAuth": "[0-9]+-[0-9A-Za-z_]{32}\\.apps\\.googleusercontent\\.com",
    "Google (GCP) Service-account": "\"type\": \"service_account\"",
   // "Google Gmail API Key": "AIza[0-9A-Za-z\\-_]{35}",
   // "Google Gmail OAuth": "[0-9]+-[0-9A-Za-z_]{32}\\.apps\\.googleusercontent\\.com",
   // "Google OAuth Access Token": "ya29\\.[0-9A-Za-z\\-_]+",
   // "Google YouTube API Key": "AIza[0-9A-Za-z\\-_]{35}",
  //  "Google YouTube OAuth": "[0-9]+-[0-9A-Za-z_]{32}\\.apps\\.googleusercontent\\.com",
    "Heroku API Key": "[hH][eE][rR][oO][kK][uU].{0,20}[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}",
    "Json Web Token" : "eyJhbGciOiJ",
    "MailChimp API Key": "[0-9a-f]{32}-us[0-9]{1,2}",
    "Mailgun API Key": "key-[0-9a-zA-Z]{32}",
    "Password in URL": "[a-zA-Z]{3,10}://[^/\\s:@]{3,20}:[^/\\s:@]{3,20}@.{1,100}[\"'\\s]",
    "PayPal Braintree Access Token": "access_token\\$production\\$[0-9a-z]{16}\\$[0-9a-f]{32}",
    "Picatic API Key": "sk_live_[0-9a-z]{32}",
    "Slack Webhook": "https://hooks\\.slack\\.com/services/T[a-zA-Z0-9_]{8}/B[a-zA-Z0-9_]{8}/[a-zA-Z0-9_]{24}",
    "Stripe API Key": "sk_live_[0-9a-zA-Z]{24}",
    "Stripe Restricted API Key": "rk_live_[0-9a-zA-Z]{24}",
    "Square Access Token": "sq0atp-[0-9A-Za-z\\-_]{22}",
    "Square OAuth Secret": "sq0csp-[0-9A-Za-z\\-_]{43}",
    "Telegram Bot API Key": "[0-9]+:AA[0-9A-Za-z\\-_]{33}",
    "Twilio API Key": "SK[0-9a-fA-F]{32}",
    "Github Auth Creds": "https:\/\/[a-zA-Z0-9]{40}@github\.com",
   // "Twitter Access Token": "[tT][wW][iI][tT][tT][eE][rR].*[1-9][0-9]+-[0-9a-zA-Z]{40}",
   // "Twitter OAuth": "[tT][wW][iI][tT][tT][eE][rR].*['|\"][0-9a-zA-Z]{35,44}['|\"]"
}

let generics = {
    "Generic API Key": "[aA][pP][iI]_?[kK][eE][yY].{0,20}['|\"][0-9a-zA-Z]{32,45}['|\"]",
    "Generic Secret": "[sS][eE][cC][rR][eE][tT].{0,20}['|\"][0-9a-zA-Z]{32,45}['|\"]",
}

let aws = {
    "AWS API Key": "((?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16})",
}

let denyList = ["AIDAAAAAAAAAAAAAAAAA"]

//--------------------------------------------------
// 5. Helper – notifications (alert replacement)
//--------------------------------------------------
function notify(text) {
  console.log('Attempting to show notification:', text);
  chrome.storage.sync.get(['alerts'], ({ alerts }) => {
    if (alerts !== false) { // Show notification unless explicitly disabled
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon48.png",
        title: "Trufflehog Secret Detected",
        message: text,
      }, (notificationId) => {
        if (chrome.runtime.lastError) {
          console.error('Notification creation failed:', chrome.runtime.lastError);
        } else {
          console.log('Notification shown successfully:', notificationId);
        }
      });
    } else {
      console.log('Notifications are disabled in settings');
    }
  });
}

//--------------------------------------------------
// 6. Badge helper
//--------------------------------------------------
async function updateBadgeForOrigin(origin) {
  console.log(`Updating badge for origin: ${origin}`);
  const { leakedKeys } = await chrome.storage.local.get("leakedKeys");
  const count = Array.isArray(leakedKeys?.[origin]) ? leakedKeys[origin].length : 0;
  console.log(`Found ${count} leaked keys for origin ${origin}`);

  await chrome.action.setBadgeText({ text: count ? String(count) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
  console.log(`Badge updated successfully for ${origin}`);
}

//--------------------------------------------------
// 7. Core analysis functions (lightly patched)
//--------------------------------------------------
function getStringsOfSet(word, charset, threshold = 20) {
  let count = 0,
    letters = "",
    strings = [];
  if (!word) return [];
  for (const ch of word) {
    if (charset.includes(ch)) {
      letters += ch;
      count += 1;
    } else {
      if (count > threshold) strings.push(letters);
      letters = "";
      count = 0;
    }
  }
  if (count > threshold) strings.push(letters);
  return strings;
}

function getDecodedb64(input) {
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const encoded = getStringsOfSet(input, B64);
  return encoded
    .map((e) => {
      try {
        return [e, atob(e)];
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function checkIfOriginDenied(url, cb) {
  console.log(`Checking if origin is denied for URL: ${url}`);
  chrome.storage.sync.get(["originDenyList"], ({ originDenyList }) => {
    const skip = originDenyList?.some((o) => url.startsWith(o));
    console.log(`Origin check result for ${url}: ${skip ? 'denied' : 'allowed'}`);
    cb(skip);
  });
}

//-----------------------------------------------------------------
// Heavy‑lifting content (minimal edits – replaced alert with notify)
//-----------------------------------------------------------------
function checkData(data, src, regexes, fromEncoded = false, parentUrl, parentOrigin) {
  console.log(`Checking data from ${src} (encoded: ${fromEncoded})`);
  console.log('Data length:', data?.length || 0, 'characters');
  console.log('Active regexes:', Object.keys(regexes).length);
  
  const findings = [];
  for (const key in regexes) {
    console.log(`Checking for ${key} pattern`);
    try {
      const re = new RegExp(regexes[key]);
      const match = re.exec(data);
      if (match) {
        console.log(`Found potential match for ${key}:`, match[0].substring(0, 20) + '...');
        if (!denyList.includes(match.toString())) {
          console.log(`Match for ${key} verified - not in deny list`);
          findings.push({ src, match: match.toString(), key, encoded: fromEncoded, parentUrl });
        } else {
          console.log(`Match for ${key} ignored - in deny list`);
        }
      }
    } catch (error) {
      console.error(`Error checking pattern for ${key}:`, error);
    }
  }

  if (findings.length) {
    console.log(`Found ${findings.length} potential secrets, processing...`);
    chrome.storage.local.get(["leakedKeys"], ({ leakedKeys }) => {
      console.log('Current stored leakedKeys:', leakedKeys);
      const keys = leakedKeys || {};
      for (const finding of findings) {
        const arr = keys[parentOrigin] || [];
        console.log(`Processing finding for ${finding.key} in ${parentOrigin}`);
        if (!arr.some((k) => JSON.stringify(k) === JSON.stringify(finding))) {
          console.log('New finding detected, saving...');
          // Trim the match if it's too long to prevent storage quota issues
          if (finding.match && finding.match.length > 1000) {
            finding.match = finding.match.substring(0, 1000) + '... (truncated)';
          }
          (keys[parentOrigin] = arr).push(finding);
          chrome.storage.local.set({ leakedKeys: keys }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error saving finding:', chrome.runtime.lastError);
            } else {
              console.log('Finding saved successfully');
              updateBadgeForOrigin(parentOrigin);
              const msg = `${finding.key}: ${finding.match.substring(0, 100)}${finding.match.length > 100 ? '...' : ''} found in ${finding.src}${fromEncoded ? " (decoded)" : ""}`;
              notify(msg);
            }
          });
        } else {
          console.log('Finding already exists, skipping');
        }
      }
    });
  }

  // recurse into decoded base64 strings
  for (const [enc, dec] of getDecodedb64(data)) {
    checkData(dec, src, regexes, enc, parentUrl, parentOrigin);
  }
}

//--------------------------------------------------
// 8. Global onMessage handler
//--------------------------------------------------
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('Message received:', request);
  (async () => {
    console.log('Loading preferences...');
    const prefs = await chrome.storage.sync.get([
      "generics",
      "specifics",
      "aws",
      "checkEnv",
      "checkGit",
    ]);
    console.log('Preferences loaded:', prefs);

    // build active regex set based on toggles
    let regexes = {};
    if (prefs.generics ?? true) Object.assign(regexes, generics);
    if (prefs.specifics ?? true) Object.assign(regexes, specifics);
    if (prefs.aws ?? true) Object.assign(regexes, aws);

    // handle the different request flavours exactly like the old code
    if (request.scriptUrl) {
      const { scriptUrl: jsUrl, parentUrl, parentOrigin } = request;
      checkIfOriginDenied(jsUrl, (skip) => {
        if (!skip) {
          fetch(jsUrl, { credentials: "include" })
            .then((r) => r.text())
            .then((txt) => checkData(txt, jsUrl, regexes, false, parentUrl, parentOrigin))
            .catch(error => {
              console.error("Error checking script:", error);
              notify(`Error checking script ${jsUrl}: ${error.message}`);
            });
        }
      });
    } else if (request.pageBody) {
      checkIfOriginDenied(request.origin, (skip) => {
        if (!skip) {
          checkData(request.pageBody, request.origin, regexes, false, request.parentUrl, request.parentOrigin);
        }
      });
    } else if (request.envFile && prefs.checkEnv) {
      fetch(request.envFile, { credentials: "include" })
        .then((r) => r.text())
        .then((txt) => checkData(txt, `.env file at ${request.envFile}`, regexes, false, request.parentUrl, request.parentOrigin))
        .catch(error => {
          console.error("Error checking .env file:", error);
          notify(`Error checking .env file: ${error.message}`);
        });
    } else if (request.openTabs) {
      request.openTabs.forEach((t) => chrome.tabs.create({ url: t }));
    } else if (request.gitDir && prefs.checkGit) {
      fetch(request.gitDir, { credentials: "include" })
        .then((r) => r.text())
        .then((txt) => {
          if (txt.startsWith("[core]")) {
            notify(`.git dir found in ${request.gitDir} (currently not parsed for secrets)`);
          }
        })
        .catch(error => {
            console.error("Error checking .git directory:", error);
            // Optionally notify user of the error
            notify(`Error checking .git directory: ${error.message}`);
        });
    }
    sendResponse();
  })();
  return true; // keep message channel open
});

//--------------------------------------------------
// 9. Keep badge up‑to‑date when the active tab changes
//--------------------------------------------------
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (tab?.url) {
      try {
        updateBadgeForOrigin(new URL(tab.url).origin);
      } catch (error) {
        console.error("Error updating badge:", error);
      }
    }
  });
});
