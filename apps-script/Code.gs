// Lion Heart Quintet sign-ups.
// Saves each sign-up to this Google Sheet and sends a Telegram alert.
// Setup steps are in README.md. The bot token lives in Script Properties, never in this code.

const SHEET_NAME = 'Sign-ups';
const HEADERS = ['Submitted', 'Name', 'Gender', 'Weight class', 'Phone', 'Telegram', 'Language', 'Agreed to rules and waiver'];
const WEIGHTS = {
  male: ['-60 kg', '-65 kg', '-70 kg', '-76 kg', '-83 kg', '-91 kg', '-100 kg', '+100 kg'],
  female: ['-50 kg', '-55 kg', '-60 kg', '-65 kg', '-70 kg', '+70 kg'],
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data._gotcha) return reply_({ ok: true }); // Spam trap.

    const signup = clean_(data);
    if (!signup) return reply_({ ok: false, error: 'invalid' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      save_(signup);
    } finally {
      lock.releaseLock();
    }

    // The sign-up is already saved, so a Telegram problem must not fail it.
    try {
      alert_(signup);
    } catch (err) {
      console.error('Telegram alert failed: ' + err);
    }
    return reply_({ ok: true });
  } catch (err) {
    console.error(err);
    return reply_({ ok: false, error: 'server' });
  }
}

// The website checks these too, but anyone can post to this URL directly.
function clean_(data) {
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const signup = {
    name: text(data.name),
    gender: text(data.gender),
    weight: text(data.weight_class),
    phone: text(data.phone),
    telegram: text(data.telegram),
    language: text(data.language),
  };
  const digits = signup.phone.replace(/\D/g, '').length;
  const valid =
    signup.name.length <= 100 &&
    signup.name.split(/\s+/).filter((word) => /\p{L}/u.test(word)).length >= 2 &&
    Object.prototype.hasOwnProperty.call(WEIGHTS, signup.gender) &&
    WEIGHTS[signup.gender].indexOf(signup.weight) !== -1 &&
    /^[+\d\s().-]{7,25}$/.test(signup.phone) && digits >= 7 && digits <= 15 &&
    /^@[A-Za-z0-9_]{5,32}$/.test(signup.telegram) &&
    ['EN', 'RU', 'AM'].indexOf(signup.language) !== -1 &&
    data.agreed_to_rules_and_waiver === true;
  return valid ? signup : null;
}

function save_(signup) {
  const sheet = getSheet_();
  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1).setValue(new Date());
  // Plain text, so "+374...", "-60 kg", "@name" or a name starting with "=" stay exactly as typed.
  sheet.getRange(row, 2, 1, HEADERS.length - 1)
    .setNumberFormat('@')
    .setValues([[signup.name, signup.gender, signup.weight, signup.phone, signup.telegram, signup.language, 'Yes']]);
}

function getSheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function alert_(signup) {
  sendTelegram_([
    'New Lion Heart Quintet sign-up',
    '',
    'Name: ' + signup.name,
    'Gender: ' + signup.gender,
    'Weight class: ' + signup.weight,
    'Phone: ' + signup.phone,
    'Telegram: ' + signup.telegram,
    'Language: ' + signup.language,
  ].join('\n'));
}

function sendTelegram_(text) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');
  const chatId = props.getProperty('TELEGRAM_CHAT_ID');
  if (!token || !chatId) throw new Error('Telegram is not set up in Script Properties.');
  const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error('Telegram said: ' + response.getContentText());
}

function reply_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

// ---- Run these by hand from the Apps Script editor during setup ----

// Prints the chat ID of whoever last messaged the bot.
function showTelegramChatId() {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('Add TELEGRAM_BOT_TOKEN to Script Properties first.');
  const updates = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates').getContentText());
  const chats = updates.result.map((u) => (u.message || u.channel_post || {}).chat).filter(Boolean);
  if (!chats.length) console.log('Nothing found. Send your bot a message, then run this again.');
  chats.forEach((chat) => console.log(chat.id + '  ' + (chat.title || chat.first_name || '')));
}

// Creates the sheet tab and sends one test alert.
function testSetup() {
  getSheet_();
  sendTelegram_('Lion Heart Quintet: alerts are working.');
  console.log('Sheet is ready and the test alert was sent.');
}
